-- ============================================================
-- 014_leader_posts_company_isolation.sql
-- Isolamento multi-tenant para leader_posts
-- ============================================================

-- 1) Adiciona company_id.
alter table public.leader_posts
  add column if not exists company_id uuid references public.companies(id);

-- 2) Backfill por post -> leader.
update public.leader_posts lp
set company_id = resolved.company_id
from (
  select
    lp.id,
    coalesce(po.company_id, pr.company_id) as company_id
  from public.leader_posts lp
  left join public.posts po on po.id = lp.post_id
  left join public.profiles pr on pr.id = lp.leader_id
) resolved
where lp.id = resolved.id
  and lp.company_id is null
  and resolved.company_id is not null;

-- 3) Bloqueia se sobrou vínculo sem empresa.
do $$
begin
  if exists (select 1 from public.leader_posts where company_id is null) then
    raise exception 'leader_posts.company_id ainda possui linhas nulas após backfill. Corrija dados órfãos antes de continuar.';
  end if;
end
$$;

-- 4) company_id obrigatório.
alter table public.leader_posts
  alter column company_id set not null;

-- 5) Índices.
create index if not exists idx_leader_posts_company_id
  on public.leader_posts(company_id);

create index if not exists idx_leader_posts_company_leader
  on public.leader_posts(company_id, leader_id);

create index if not exists idx_leader_posts_company_post
  on public.leader_posts(company_id, post_id);

-- 6) Trigger para preencher e validar company_id automaticamente.
create or replace function public.set_leader_post_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_company_id uuid;
  leader_company_id uuid;
  resolved_company_id uuid;
begin
  select company_id into post_company_id
  from public.posts
  where id = new.post_id;

  select company_id into leader_company_id
  from public.profiles
  where id = new.leader_id;

  resolved_company_id := coalesce(post_company_id, leader_company_id);

  if new.company_id is null then
    new.company_id := resolved_company_id;
  end if;

  if new.company_id is null then
    raise exception 'Não foi possível resolver company_id para leader_posts.';
  end if;

  if post_company_id is not null and new.company_id <> post_company_id then
    raise exception 'company_id do vínculo não confere com o posto.';
  end if;

  if leader_company_id is not null and new.company_id <> leader_company_id then
    raise exception 'company_id do vínculo não confere com o líder.';
  end if;

  if post_company_id is not null
     and leader_company_id is not null
     and post_company_id <> leader_company_id then
    raise exception 'Líder e posto pertencem a empresas diferentes.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_leader_post_company_id on public.leader_posts;

create trigger trg_set_leader_post_company_id
before insert or update of company_id, leader_id, post_id
on public.leader_posts
for each row
execute function public.set_leader_post_company_id();

-- 7) RLS reforçada por empresa.
alter table public.leader_posts enable row level security;

drop policy if exists leader_posts_read on public.leader_posts;
drop policy if exists leader_posts_manage on public.leader_posts;
drop policy if exists leader_posts_insert on public.leader_posts;
drop policy if exists leader_posts_update on public.leader_posts;
drop policy if exists leader_posts_delete on public.leader_posts;

create policy leader_posts_read
on public.leader_posts
for select
using (
  company_id = public.current_company_id()
  and (
    leader_id = (select id from public.current_profile())
    or public.has_any_role(array['supervisor','gerente','diretor','admin'])
  )
);

create policy leader_posts_insert
on public.leader_posts
for insert
with check (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente','supervisor'])
);

create policy leader_posts_update
on public.leader_posts
for update
using (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente','supervisor'])
)
with check (
  company_id = public.current_company_id()
);

create policy leader_posts_delete
on public.leader_posts
for delete
using (
  company_id = public.current_company_id()
  and public.has_any_role(array['admin','gerente','supervisor'])
);
