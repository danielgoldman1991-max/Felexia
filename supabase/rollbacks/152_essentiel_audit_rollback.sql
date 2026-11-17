-- Rollback of 152. Reapply 147 to restore the previous posted-entry guard,
-- and 151 to restore the previous bundle. Does not change stored settings.
drop trigger if exists cash_non_negative on public.treasury_transactions;
drop function if exists app_private.guard_cash_non_negative();
drop function if exists app_private.refresh_restored_invoice_status(uuid, text, jsonb);
drop function if exists app_private.restore_confirmation_name(text);
drop function if exists app_private.restore_external_module(text);
drop function if exists app_private.restore_table_in_backup(text, boolean);
drop function if exists app_private.restore_pro_tables();
drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text, boolean);
drop function if exists app_private.restore_reject_external_refs(uuid, text, uuid[], boolean);
drop function if exists app_private.restore_detach_inbound_fks(uuid, text, uuid[], integer, boolean);
drop table if exists public.organization_restore_audit;
alter table public.accounting_settings alter column auto_post_on_validation set default false;
