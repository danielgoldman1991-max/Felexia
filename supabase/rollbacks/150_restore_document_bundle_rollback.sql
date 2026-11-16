-- Rollback of 150. Drops only the new bundle function. The posted-entry guard
-- is unchanged from migration 147.
drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[]);
