-- ============================================================
-- 012_location_tracking_company_isolation.sql
-- Isolamento multi-tenant para location_tracking
-- ============================================================

-- 1) Adiciona company_id.
alter table public.location_tracking
  add column if not exists company_id uuid references public.companies(id);

-- 2) Backfill por employee_id -> profiles.
update public.location_tracking lt
set company_id = p.company_id
from public.profiles p
where p.id = lt.employee_id
  and lt.company_id is null
  and p.company_id is not null;

-- 3) Bloqueia se ainda existir localização sem empresa.
do $$
begin
  if exists (select 1 from public.location_tracking where company_id is null) then
    raise exception 'location_tracking.company_id ainda possui linhas nulas após backfill. Corrija dados órfãos antes de continuar.';
  end if;
end
$$;

-- 4) Agora company_id fica obrigatório.
alter table public.location_tracking
  alter column company_id set not null;

-- 5) Índices.
create index if not exists idx_location_tracking_company_id
  on public.location_tracking(company_id);

create index if not exists idx_location_tracking_company_employee
  on public.location_tracking(company_id, employee_id);

-- 6) Trigger para preencher e validar company_id automaticamente.
create or replace function public.set_location_tracking_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_company_id uuid;
begin
  select company_id into employee_company_id
  from public.profiles
  where id = new.employee_id;

  if new.company_id is null then
    new.company_id := employee_company_id;
  end if;

  if new.company_id is null then
    raise exception 'Não foi possível resolver company_id para location_tracking.';
  end if;

  if employee_company_id is not null and new.company_id <> employee_company_id then
    raise exception 'company_id da localização não confere com o funcionário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_location_tracking_company_id on public.location_tracking;

create trigger trg_set_location_tracking_company_id
before insert or update of company_id, employee_id
on public.location_tracking
for each row
execute function public.set_location_tracking_company_id();

-- 7) RLS reforçada por empresa.
alter table public.location_tracking enable row level security;

drop policy if exists location_tracking_read on public.location_tracking;
drop policy if exists location_tracking_insert on public.location_tracking;
drop policy if exists location_tracking_update on public.location_tracking;

create policy location_tracking_read
on public.location_tracking
for select
using (
  company_id = public.current_company_id()
  and (
    employee_id = (select id from public.current_profile())
    or public.has_any_role(array['lider','supervisor','gerente','diretor','admin'])
  )
);

create policy location_tracking_insert
on public.location_tracking
for insert
with check (
  company_id = public.current_company_id()
  and employee_id = (select id from public.current_profile())
);

create policy location_tracking_update
on public.location_tracking
for update
using (
  company_id = public.current_company_id()
  and (
    employee_id = (select id from public.current_profile())
    or public.has_any_role(array['supervisor','gerente','diretor','admin'])
  )
)
with check (
  company_id = public.current_company_id()
);
