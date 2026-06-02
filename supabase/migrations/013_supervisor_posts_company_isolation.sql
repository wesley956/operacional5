-- ============================================================
-- 013_supervisor_posts_company_isolation.sql
-- Isolamento multi-tenant para supervisor_posts
-- ============================================================

-- 1) Adiciona company_id.
alter table public.supervisor_posts
  add column if not exists company_id uuid references public.companies(id);

-- 2) Backfill por post -> supervisor.
update public.supervisor_posts sp
set company_id = resolved.company_id
from (
  select
    sp.id,
    coalesce(po.company_id, pr.company_id) as company_id
  from public.supervisor_posts sp
  left join public.posts po on po.id = sp.post_id
  left join public.profiles pr on pr.id = sp.supervisor_id
) resolved
where sp.id = resolved.id
  and sp.company_id is null
  and resolved.company_id is not null;

-- 3) Bloqueia se sobrou vínculo sem empresa.
do $$
begin
  if exists (select 1 from public.supervisor_posts where company_id is null) then
    raise exception 'supervisor_posts.company_id ainda possui linhas nulas após backfill. Corrija dados órfãos antes de continuar.';
  end if;
end
$$;

-- 4) company_id obrigatório.
alter table public.supervisor_posts
  alter column company_id set not null;

-- 5) Índices.
create index if not exists idx_supervisor_posts_company_id
  on public.supervisor_posts(company_id);

create index if not exists idx_supervisor_posts_company_supervisor
  on public.supervisor_posts(company_id, supervisor_id);

create index if not exists idx_supervisor_posts_company_post
  on public.supervisor_posts(company_id, post_id);

-- 6) Trigger para preencher e validar company_id automaticamente.
create or replace function public.set_supervisor_post_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_company_id uuid;
  supervisor_company_id uuid;
  resolved_company_id uuid;
begin
  select company_id into post_company_id
  from public.posts
  where id = new.post_id;

  select company_id into supervisor_company_id
  from public.profiles
  where id = new.supervisor_id;

  resolved_company_id := coalesce(post_company_id, supervisor_company_id);

  if new.company_id is null then
    new.company_id := resolved_company_id;
  end if;

  if new.company_id is null then
    raise exception 'Não foi possível resolver company_id para supervisor_posts.';
  end if;

  if post_company_id is not null and new.company_id <> post_company_id then
    raise exception 'company_id do vínculo não confere com o posto.';
  end if;

  if supervisor_company_id is not null and new.company_id <> supervisor_company_id then
    raise exception 'company_id do vínculo não confere com o supervisor.';
  end if;

  if post_company_id is not null
     and supervisor_company_id is not null
     and post_company_id <> supervisor_company_id then
    raise exception 'Supervisor e posto pertencem a empresas diferentes.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_supervisor_post_company_id on public.supervisor_posts;

create trigger trg_set_supervisor_post_company_id
before insert or update of company_id, supervisor_id, post_id
on public.supervisor_posts
for each row
execute function public.set_supervisor_post_company_id();

-- 7) RLS reforçada por empresa.
alter table public.supervisor_posts enable row level security;

drop policy if exists supervisor_posts_read on public.supervisor_posts;
drop policy if exists supervisor_posts_manage on public.supervisor_posts;
drop policy if exists supervisor_posts_insert on public.supervisor_posts;
drop policy if exists supervisor_posts_update on public.supervisor_posts;
drop policy if exists supervisor_posts_delete on public.supervisor_posts;

create policy supervisor_posts_read
on public.supervisor_posts
for select
using (
  company_id = public.current_company_id()
  and (
    supervisor_id = (select id from public.current_profile())
    or public.has_any_role(array['gerente','diretor','admin'])
  )
);

create policy supervisor_posts_insert
on public.supervisor_posts
for insert
with check (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente'])
);

create policy supervisor_posts_update
on public.supervisor_posts
for update
using (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente'])
)
with check (
  company_id = public.current_company_id()
);

create policy supervisor_posts_delete
on public.supervisor_posts
for delete
using (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente'])
);
