-- 130: lien facultatif d'un journal vers un compte de trésorerie.
-- Additive. Existing journals stay unlinked.
--
-- Rollback: supabase/rollbacks/130_accounting_journal_treasury_account_rollback.sql

alter table public.accounting_journals
  add column if not exists treasury_account_id uuid null;
