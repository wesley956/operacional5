-- Enable Supabase Realtime for operational tables used by the web app.
-- This migration is intentionally safe for environments where some tables
-- may not exist yet or may already be part of the publication.

create or replace function public.add_table_to_realtime_if_exists(table_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = table_name
  ) then
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then
        null;
      when undefined_object then
        null;
    end;
  end if;
end;
$$;

select public.add_table_to_realtime_if_exists('alert_log');
select public.add_table_to_realtime_if_exists('occurrences');
select public.add_table_to_realtime_if_exists('presences');
select public.add_table_to_realtime_if_exists('ft_requests');
select public.add_table_to_realtime_if_exists('posts');
select public.add_table_to_realtime_if_exists('schedules');
select public.add_table_to_realtime_if_exists('notification_logs');

drop function public.add_table_to_realtime_if_exists(text);
