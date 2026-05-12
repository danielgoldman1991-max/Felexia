-- 037_add_source_number_to_accounting_entries.sql
-- Adds source_number column to accounting_entries for display of source document numbers.
-- Idempotent.

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounting_entries' and column_name = 'source_number'
  ) then
    alter table public.accounting_entries add column source_number text null;
  end if;
end $$;
