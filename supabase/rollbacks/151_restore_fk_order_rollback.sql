-- Rollback of 151. Drops the helper and the 10-argument bundle.
-- Reapply 150 to restore the previous bundle. Does not change accounting guards.
drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text);
drop function if exists app_private.restore_detach_inbound_fks(uuid, text, uuid[], integer);
drop function if exists app_private.restore_reject_external_refs(uuid, text, uuid[]);
drop function if exists app_private.restore_backup_tables();
