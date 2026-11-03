-- 117: verrou de période et date de clôture, si les tables existent déjà.
-- Additive. Missing accounting tables are left untouched. No journal line is rewritten.
--
-- Rollback:
-- alter table public.accounting_periods drop column if exists locked_at;
-- alter table public.accounting_periods drop column if exists lock_reason;
-- alter table public.accounting_fiscal_years drop column if exists closed_at;

do $$ begin
  if to_regclass('public.accounting_periods') is not null then
    alter table public.accounting_periods add column if not exists locked_at timestamptz;
    alter table public.accounting_periods add column if not exists lock_reason text;
  end if;
  if to_regclass('public.accounting_fiscal_years') is not null then
    alter table public.accounting_fiscal_years add column if not exists closed_at timestamptz;
  end if;
end $$;
