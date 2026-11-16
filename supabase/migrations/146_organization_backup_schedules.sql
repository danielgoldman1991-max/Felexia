-- Additive schedule and history for automatic organization backups.
-- Not applied by the application. Back up production before running it.
-- The private bucket stores ZIP files. Authenticated users cannot upload it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-backups', 'organization-backups', false, 20971520, array['application/zip'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.organization_backup_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'monthly')),
  weekdays smallint[] not null default '{1}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(weekdays) >= 1),
  month_day smallint not null default 1 check (month_day between 1 and 31),
  hour smallint not null default 2 check (hour between 0 and 23),
  minute smallint not null default 0 check (minute in (0, 30)),
  retention_count smallint not null default 7 check (retention_count between 3 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_backup_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.organization_backup_schedules(id) on delete set null,
  slot_key text not null,
  status text not null check (status in ('running', 'ok', 'failed', 'purged')),
  byte_size bigint,
  storage_path text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (organization_id, slot_key)
);

create index if not exists organization_backup_runs_org_finished_idx
  on public.organization_backup_runs (organization_id, finished_at desc);

alter table public.organization_backup_schedules enable row level security;
alter table public.organization_backup_runs enable row level security;

drop policy if exists organization_backup_schedules_admin on public.organization_backup_schedules;
create policy organization_backup_schedules_admin
on public.organization_backup_schedules
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.organization_id = organization_backup_schedules.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  )
)
with check (
  exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.organization_id = organization_backup_schedules.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  )
);

drop policy if exists organization_backup_runs_admin_read on public.organization_backup_runs;
create policy organization_backup_runs_admin_read
on public.organization_backup_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.organization_id = organization_backup_runs.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  )
);

drop policy if exists organization_backups_read on storage.objects;
create policy organization_backups_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'organization-backups'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.organization_id::text = (storage.foldername(name))[2]
      and member.user_id = auth.uid()
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  )
);

grant select, insert, update, delete on public.organization_backup_schedules to authenticated;
grant select on public.organization_backup_runs to authenticated;
