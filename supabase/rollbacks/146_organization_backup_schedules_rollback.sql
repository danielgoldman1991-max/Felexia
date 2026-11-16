drop policy if exists organization_backups_read on storage.objects;
delete from storage.objects where bucket_id = 'organization-backups';
delete from storage.buckets where id = 'organization-backups';
drop table if exists public.organization_backup_runs;
drop table if exists public.organization_backup_schedules;
