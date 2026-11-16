-- Rollback of 149. Does not delete business data.
drop function if exists public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[]);
