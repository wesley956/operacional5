-- ============================================================
-- 010_presences_company_isolation.sql
-- Isolamento multi-tenant para presences
-- ============================================================

-- 1) Adiciona company_id sem quebrar inserts antigos imediatamente.
alter table public.presences
  add column if not exists company_id uuid references public.companies(id);

-- 2) Backfill seguro por schedule -> post -> profile.
update public.presences p
set company_id = resolved.company_id
from (
  select
    p.id,
    coalesce(s.company_id, po.company_id, pr.company_id) as company_id
  from public.presences p
  left join public.schedules s on s.id = p.schedule_id
  left join public.posts po on po.id = p.post_id
  left join public.profiles pr on pr.id = p.employee_id
) resolved
where p.id = resolved.id
  and p.company_id is null
  and resolved.company_id is not null;

-- 3) Impede seguir se ainda existir presença sem empresa resolvida.
do $$
begin
  if exists (select 1 from public.presences where company_id is null) then
    raise exception 'presences.company_id ainda possui linhas nulas após backfill. Corrija dados órfãos antes de continuar.';
  end if;
end
$$;

-- 4) Agora torna obrigatório.
alter table public.presences
  alter column company_id set not null;

-- 5) Índices para RLS e consultas operacionais.
create index if not exists idx_presences_company_id
  on public.presences(company_id);

create index if not exists idx_presences_company_status
  on public.presences(company_id, status);

create index if not exists idx_presences_company_post
  on public.presences(company_id, post_id);

create index if not exists idx_presences_company_employee
  on public.presences(company_id, employee_id);

-- 6) Trigger para preencher company_id automaticamente.
create or replace function public.set_presence_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_company_id uuid;
begin
  select coalesce(s.company_id, po.company_id, pr.company_id)
    into resolved_company_id
  from (select 1) x
  left join public.schedules s on s.id = new.schedule_id
  left join public.posts po on po.id = new.post_id
  left join public.profiles pr on pr.id = new.employee_id;

  if new.company_id is null then
    new.company_id := resolved_company_id;
  end if;

  if new.company_id is null then
    raise exception 'Não foi possível resolver company_id para presences.';
  end if;

  if resolved_company_id is not null and new.company_id <> resolved_company_id then
    raise exception 'company_id da presença não confere com schedule/post/profile.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_presence_company_id on public.presences;

create trigger trg_set_presence_company_id
before insert or update of company_id, schedule_id, post_id, employee_id
on public.presences
for each row
execute function public.set_presence_company_id();

-- 7) RLS reforçada por empresa.
alter table public.presences enable row level security;

drop policy if exists presences_read on public.presences;
drop policy if exists presences_insert on public.presences;
drop policy if exists presences_update on public.presences;

create policy presences_read
on public.presences
for select
using (
  company_id = public.current_company_id()
  and (
    employee_id = (select id from public.current_profile())
    or public.has_any_role(array['lider','supervisor','gerente','diretor','admin'])
  )
);

create policy presences_insert
on public.presences
for insert
with check (
  company_id = public.current_company_id()
  and (
    employee_id = (select id from public.current_profile())
    or public.has_any_role(array['admin','gerente'])
  )
);

create policy presences_update
on public.presences
for update
using (
  company_id = public.current_company_id()
  and public.has_any_role(array['supervisor','gerente','diretor','admin'])
)
with check (
  company_id = public.current_company_id()
);
