-- Client Portal Auth
-- Adds a real external client viewer role scoped to a single client.

alter table public.profiles
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists idx_profiles_client_id
  on public.profiles(client_id);

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client_viewer','operador','lider','supervisor','gerente','diretor','admin'));

alter table public.profiles
  drop constraint if exists profiles_client_viewer_requires_client;

alter table public.profiles
  add constraint profiles_client_viewer_requires_client
  check (role <> 'client_viewer' or client_id is not null);

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id
  from public.profiles
  where user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.ensure_profile_client_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null and not exists (
    select 1
    from public.clients c
    where c.id = new.client_id
      and c.company_id = new.company_id
  ) then
    raise exception 'client_id must belong to the same company_id as the profile';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_client_company_guard on public.profiles;

create trigger profiles_client_company_guard
before insert or update of client_id, company_id
on public.profiles
for each row
execute function public.ensure_profile_client_same_company();

drop policy if exists "profiles_read_company" on public.profiles;

create policy "profiles_read_company" on public.profiles for select
  using (
    user_id = auth.uid()
    or (
      company_id = public.current_company_id()
      and public.has_any_role(array['operador','lider','supervisor','gerente','diretor','admin'])
    )
  );

drop policy if exists "clients_read_company" on public.clients;

create policy "clients_read_company" on public.clients for select
  using (
    company_id = public.current_company_id()
    and (
      public.has_any_role(array['operador','lider','supervisor','gerente','diretor','admin'])
      or id = public.current_client_id()
    )
  );

drop policy if exists "posts_read_accessible" on public.posts;

create policy "posts_read_accessible" on public.posts for select
  using (
    company_id = public.current_company_id()
    and (
      public.has_any_role(array['operador','lider','supervisor','gerente','diretor','admin'])
      or client_id = public.current_client_id()
    )
  );

drop policy if exists "occurrences_read" on public.occurrences;

create policy "occurrences_read" on public.occurrences for select
  using (
    company_id = public.current_company_id()
    and (
      employee_id = (select id from public.current_profile())
      or public.has_any_role(array['lider','supervisor','gerente','diretor','admin'])
      or exists (
        select 1
        from public.posts p
        where p.id = occurrences.post_id
          and p.client_id = public.current_client_id()
      )
    )
  );
