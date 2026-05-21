-- DGI VAT preparatory XML export chain.
-- Additive migration: keeps the previous tax_export_batches table/data and expands it
-- for XML/CSV/manifest history, private Storage, idempotency and RLS.

create table if not exists public.tax_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_number text not null,
  export_type text not null default 'dgi_vat_xml_prep',
  period_start date null,
  period_end date null,
  format text not null default 'xml',
  status text not null default 'draft',
  file_name text null,
  file_path text null,
  generated_by uuid null references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

alter table public.tax_export_batches
  add column if not exists frequency text null,
  add column if not exists regime text null,
  add column if not exists file_url text null,
  add column if not exists controls_summary jsonb null,
  add column if not exists totals jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists idempotency_key text null,
  add column if not exists schema_version text not null default 'felexia-prep-1.0',
  add column if not exists official_schema_version text null,
  add column if not exists source_snapshot_hash text null,
  add column if not exists file_bucket text not null default 'tax-exports',
  add column if not exists xml_path text null,
  add column if not exists csv_path text null,
  add column if not exists xlsx_path text null,
  add column if not exists manifest_path text null,
  add column if not exists validation_report_path text null,
  add column if not exists preflight_summary jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists download_count integer not null default 0,
  add column if not exists downloaded_at timestamptz null;

update public.tax_export_batches
set
  export_type = coalesce(nullif(export_type, ''), 'dgi_vat_xml_prep'),
  format = coalesce(nullif(format, ''), 'xml'),
  status = coalesce(nullif(status, ''), 'draft'),
  frequency = coalesce(frequency, case when regime = 'quarterly' then 'quarterly' else 'monthly' end),
  file_bucket = coalesce(nullif(file_bucket, ''), 'tax-exports'),
  schema_version = coalesce(nullif(schema_version, ''), 'felexia-prep-1.0'),
  source_snapshot_hash = coalesce(nullif(source_snapshot_hash, ''), 'sha256:legacy-' || id::text),
  idempotency_key = coalesce(nullif(idempotency_key, ''), 'legacy-' || id::text),
  totals = coalesce(totals, '{}'::jsonb),
  preflight_summary = coalesce(preflight_summary, controls_summary, '{}'::jsonb),
  warnings = coalesce(warnings, '[]'::jsonb),
  validation_errors = coalesce(validation_errors, '[]'::jsonb);

update public.tax_export_batches
set
  period_start = coalesce(period_start, created_at::date, current_date),
  period_end = coalesce(period_end, period_start, created_at::date, current_date),
  frequency = coalesce(frequency, 'monthly');

alter table public.tax_export_batches
  alter column period_start set not null,
  alter column period_end set not null,
  alter column frequency set not null,
  alter column idempotency_key set not null,
  alter column source_snapshot_hash set not null;

do $$
begin
  alter table public.tax_export_batches drop constraint if exists tax_export_batches_status_check;
  alter table public.tax_export_batches
    add constraint tax_export_batches_status_check
    check (status in (
      'draft',
      'previewed',
      'blocked',
      'preflight_failed',
      'ready',
      'ready_to_generate',
      'generated',
      'generated_with_warnings',
      'downloaded',
      'superseded',
      'archived',
      'failed'
    ));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.tax_export_batches drop constraint if exists tax_export_batches_format_check;
  alter table public.tax_export_batches
    add constraint tax_export_batches_format_check
    check (format in ('xml', 'csv', 'xlsx', 'excel', 'dgi', 'zip', 'pdf', 'json'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.tax_export_batches drop constraint if exists tax_export_batches_frequency_check;
  alter table public.tax_export_batches
    add constraint tax_export_batches_frequency_check
    check (frequency in ('monthly', 'quarterly'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists tax_export_batches_org_idempotency_key_idx
  on public.tax_export_batches (organization_id, idempotency_key);

create index if not exists idx_tax_export_batches_org_period
  on public.tax_export_batches (organization_id, period_start, period_end);

create index if not exists idx_tax_export_batches_status
  on public.tax_export_batches (status);

create index if not exists idx_tax_export_batches_created_at
  on public.tax_export_batches (created_at desc);

alter table public.tax_export_batches enable row level security;

drop policy if exists tax_export_batches_select on public.tax_export_batches;
drop policy if exists tax_export_batches_insert on public.tax_export_batches;
drop policy if exists tax_export_batches_update on public.tax_export_batches;
drop policy if exists tax_export_batches_org_member_select on public.tax_export_batches;
drop policy if exists tax_export_batches_org_member_insert on public.tax_export_batches;
drop policy if exists tax_export_batches_org_member_update on public.tax_export_batches;

create policy tax_export_batches_select
on public.tax_export_batches
for select
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = tax_export_batches.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
  )
);

create policy tax_export_batches_insert
on public.tax_export_batches
for insert
with check (
  exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.organization_id = tax_export_batches.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
  )
);

create policy tax_export_batches_update
on public.tax_export_batches
for update
using (
  exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.organization_id = tax_export_batches.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.organization_id = tax_export_batches.organization_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
  )
);

grant select, insert, update on public.tax_export_batches to authenticated;

drop trigger if exists tax_export_batches_set_updated_at on public.tax_export_batches;
create trigger tax_export_batches_set_updated_at
before update on public.tax_export_batches
for each row execute function public.set_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tax-exports',
  'tax-exports',
  false,
  52428800,
  array[
    'application/xml',
    'text/xml',
    'text/csv',
    'application/json',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/xml',
    'text/xml',
    'text/csv',
    'application/json',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

drop policy if exists "Authenticated users can read tax exports" on storage.objects;
drop policy if exists "Authenticated users can upload tax exports" on storage.objects;
drop policy if exists "Authenticated users can update tax exports" on storage.objects;
drop policy if exists "Authenticated users can delete tax exports" on storage.objects;
drop policy if exists tax_exports_storage_select on storage.objects;
drop policy if exists tax_exports_storage_insert on storage.objects;
drop policy if exists tax_exports_storage_update on storage.objects;
drop policy if exists tax_exports_storage_delete on storage.objects;

create policy tax_exports_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tax-exports'
  and exists (
    select 1
    from public.organization_members m
    where m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and name like ('organizations/' || m.organization_id::text || '/%')
  )
);

create policy tax_exports_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tax-exports'
  and exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
      and name like ('organizations/' || m.organization_id::text || '/%')
  )
);

create policy tax_exports_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tax-exports'
  and exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
      and name like ('organizations/' || m.organization_id::text || '/%')
  )
)
with check (
  bucket_id = 'tax-exports'
  and exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
      and name like ('organizations/' || m.organization_id::text || '/%')
  )
);

create policy tax_exports_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tax-exports'
  and exists (
    select 1
    from public.organization_members m
    left join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur')
      and name like ('organizations/' || m.organization_id::text || '/%')
  )
);
