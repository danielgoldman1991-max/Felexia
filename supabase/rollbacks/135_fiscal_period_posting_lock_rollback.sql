-- Rollback 135. Drops the posting lock triggers. Period rows and locked_at values are kept.

drop trigger if exists fiscal_period_lock_entries_135 on public.accounting_entries;
drop trigger if exists fiscal_period_lock_customer_invoices_135 on public.customer_invoices;
drop trigger if exists fiscal_period_lock_supplier_invoices_135 on public.supplier_invoices;
drop function if exists app_private.guard_locked_fiscal_period();
drop function if exists app_private.period_is_locked(uuid, date);
