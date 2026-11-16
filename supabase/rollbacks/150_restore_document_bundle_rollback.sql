-- Rollback of 150. Does not delete business data.
-- Replaying migration 098 restores the previous posted-entry guard.
drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[]);
