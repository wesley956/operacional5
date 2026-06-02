-- ============================================================
-- 011_shift_handovers_company_isolation.sql
-- Isolamento multi-tenant para shift_handovers
-- ============================================================

-- 1) Adiciona company_id.
alter table public.shift_handovers
  add column if not exists company_id uuid references public.companies(id);

-- 2) Backfill seguro por post -> outgoing -> incoming.
update public.shift_handovers h
set company_id = resolved.company_id
from (
  select
    h.id,
    coalesce(po.company_id, outp.company_id, inp.company_id) as company_id
  from public.shift_handovers h
  left join public.posts po on po.id = h.post_id
  left join public.profiles outp on outp.id = h.outgoing_employee_id
  left join public.profiles inp on inp.id = h.incoming_employee_id
) resolved
where h.id = resolved.id
  and h.company_id is null
  and resolved.company_id is not null;

-- 3) Bloqueia se sobrou passagem sem empresa.
do $$
begin
  if exists (select 1 from public.shift_handovers where company_id is null) then
    raise exception 'shift_handovers.company_id ainda possui linhas nulas após backfill. Corrija dados órfãos antes de continuar.';
  end if;
end
$$;

-- 4) Agora company_id fica obrigatório.
alter table public.shift_handovers
  alter column company_id set not null;

-- 5) Índices.
create index if not exists idx_shift_handovers_company_id
  on public.shift_handovers(company_id);

create index if not exists idx_shift_handovers_company_post
  on public.shift_handovers(company_id, post_id);

create index if not exists idx_shift_handovers_company_status
  on public.shift_handovers(company_id, status);

create index if not exists idx_shift_handovers_company_created_at
  on public.shift_handovers(company_id, created_at desc);

-- 6) Trigger para preencher e validar company_id automaticamente.
create or replace function public.set_shift_handover_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_company_id uuid;
  outgoing_company_id uuid;
  incoming_company_id uuid;
  resolved_company_id uuid;
begin
  select company_id into post_company_id
  from public.posts
  where id = new.post_id;

  select company_id into outgoing_company_id
  from public.profiles
  where id = new.outgoing_employee_id;

  select company_id into incoming_company_id
  from public.profiles
  where id = new.incoming_employee_id;

  resolved_company_id := coalesce(post_company_id, outgoing_company_id, incoming_company_id);

  if new.company_id is null then
    new.company_id := resolved_company_id;
  end if;

  if new.company_id is null then
    raise exception 'Não foi possível resolver company_id para shift_handovers.';
  end if;

  if post_company_id is not null and new.company_id <> post_company_id then
    raise exception 'company_id da passagem não confere com o posto.';
  end if;

  if outgoing_company_id is not null and new.company_id <> outgoing_company_id then
    raise exception 'company_id da passagem não confere com o funcionário de saída.';
  end if;

  if incoming_company_id is not null and new.company_id <> incoming_company_id then
    raise exception 'company_id da passagem não confere com o funcionário de entrada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_shift_handover_company_id on public.shift_handovers;

create trigger trg_set_shift_handover_company_id
before insert or update of company_id, post_id, outgoing_employee_id, incoming_employee_id
on public.shift_handovers
for each row
execute function public.set_shift_handover_company_id();

-- 7) RLS reforçada por empresa.
alter table public.shift_handovers enable row level security;

drop policy if exists shift_handovers_read on public.shift_handovers;
drop policy if exists shift_handovers_insert on public.shift_handovers;
drop policy if exists shift_handovers_update on public.shift_handovers;

create policy shift_handovers_read
on public.shift_handovers
for select
using (
  company_id = public.current_company_id()
  and (
    outgoing_employee_id = (select id from public.current_profile())
    or incoming_employee_id = (select id from public.current_profile())
    or public.has_any_role(array['lider','supervisor','gerente','diretor','admin'])
  )
);

create policy shift_handovers_insert
on public.shift_handovers
for insert
with check (
  company_id = public.current_company_id()
  and (
    outgoing_employee_id = (select id from public.current_profile())
    or public.has_any_role(array['admin','gerente','supervisor'])
  )
);

create policy shift_handovers_update
on public.shift_handovers
for update
using (
  company_id = public.current_company_id()
  and (
    incoming_employee_id = (select id from public.current_profile())
    or outgoing_employee_id = (select id from public.current_profile())
    or public.has_any_role(array['supervisor','gerente','diretor','admin'])
  )
)
with check (
  company_id = public.current_company_id()
);
