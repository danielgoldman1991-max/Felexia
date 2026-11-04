-- 135: refuse posting and invoice validation inside a locked fiscal period.
-- Apply after 134. Additive. Open periods and existing posted entries are unchanged.
-- A period is locked when status is locked or closed, or locked_at is set (migration 117).
-- Rollback: supabase/rollbacks/135_fiscal_period_posting_lock_rollback.sql

do $$ begin
  if to_regclass('public.accounting_periods') is not null then
    alter table public.accounting_periods add column if not exists locked_at timestamptz;
    alter table public.accounting_periods add column if not exists lock_reason text;
  end if;
end $$;

create or replace function app_private.period_is_locked(p_organization_id uuid, p_date date)
returns boolean language plpgsql stable security definer set search_path=public
as $$
begin
  if p_date is null or to_regclass('public.accounting_periods') is null then
    return false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounting_periods' and column_name = 'status'
  ) then
    return false;
  end if;
  return exists (
    select 1 from public.accounting_periods
    where organization_id = p_organization_id
      and start_date <= p_date
      and end_date >= p_date
      and (
        status in ('locked', 'closed')
        or locked_at is not null
      )
  );
end; $$;

revoke all on function app_private.period_is_locked(uuid, date) from public, anon;
grant execute on function app_private.period_is_locked(uuid, date) to authenticated;

create or replace function app_private.guard_locked_fiscal_period()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare doc_date date;
begin
  if tg_table_name = 'accounting_entries' then
    if new.status is distinct from 'posted' then return new; end if;
    if tg_op = 'UPDATE' and old.status = 'posted' then return new; end if;
    doc_date := new.entry_date;
  elsif tg_table_name = 'customer_invoices' then
    if tg_op = 'UPDATE' and old.status is distinct from 'draft' then return new; end if;
    if new.status not in ('validated', 'sent', 'partially_paid', 'paid', 'overdue') then return new; end if;
    doc_date := new.invoice_date;
  elsif tg_table_name = 'supplier_invoices' then
    if tg_op = 'UPDATE' and old.status is distinct from 'draft' then return new; end if;
    if new.status not in ('validated', 'partially_paid', 'paid') then return new; end if;
    doc_date := new.invoice_date;
  else
    return new;
  end if;
  if app_private.period_is_locked(new.organization_id, doc_date) then
    raise exception 'FINANCE_PERIOD_LOCKED' using errcode = '42501';
  end if;
  return new;
end; $$;

revoke all on function app_private.guard_locked_fiscal_period() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.accounting_entries') is not null then
    drop trigger if exists fiscal_period_lock_entries_135 on public.accounting_entries;
    create trigger fiscal_period_lock_entries_135
      before insert or update of status, entry_date on public.accounting_entries
      for each row execute function app_private.guard_locked_fiscal_period();
  end if;
  if to_regclass('public.customer_invoices') is not null then
    drop trigger if exists fiscal_period_lock_customer_invoices_135 on public.customer_invoices;
    create trigger fiscal_period_lock_customer_invoices_135
      before update of status on public.customer_invoices
      for each row execute function app_private.guard_locked_fiscal_period();
  end if;
  if to_regclass('public.supplier_invoices') is not null then
    drop trigger if exists fiscal_period_lock_supplier_invoices_135 on public.supplier_invoices;
    create trigger fiscal_period_lock_supplier_invoices_135
      before update of status on public.supplier_invoices
      for each row execute function app_private.guard_locked_fiscal_period();
  end if;
end $$;
