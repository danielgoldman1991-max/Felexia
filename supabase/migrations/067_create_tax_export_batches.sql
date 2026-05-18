create table if not exists public.tax_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_number text not null,
  export_type text not null,
  period_start date null,
  period_end date null,
  format text not null,
  status text not null default 'generated',
  file_name text null,
  file_path text null,
  generated_by uuid null references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now(),
  constraint tax_export_batches_status_check check (status in ('generated', 'downloaded', 'archived', 'failed')),
  constraint tax_export_batches_format_check check (format in ('csv', 'excel', 'dgi', 'zip', 'pdf')),
  constraint tax_export_batches_export_number_not_empty check (length(trim(export_number)) > 0)
);

create unique index if not exists tax_export_batches_org_number_idx
on public.tax_export_batches (organization_id, export_number);

create index if not exists tax_export_batches_organization_id_idx
on public.tax_export_batches (organization_id);

create index if not exists tax_export_batches_export_type_idx
on public.tax_export_batches (export_type);

create index if not exists tax_export_batches_period_idx
on public.tax_export_batches (period_start, period_end);

create index if not exists tax_export_batches_generated_at_idx
on public.tax_export_batches (generated_at);

alter table public.tax_export_batches enable row level security;

drop policy if exists tax_export_batches_org_member_select on public.tax_export_batches;
create policy tax_export_batches_org_member_select
on public.tax_export_batches
for select
using (app_private.is_org_member(organization_id));

drop policy if exists tax_export_batches_org_member_insert on public.tax_export_batches;
create policy tax_export_batches_org_member_insert
on public.tax_export_batches
for insert
with check (app_private.is_org_member(organization_id));

drop policy if exists tax_export_batches_org_member_update on public.tax_export_batches;
create policy tax_export_batches_org_member_update
on public.tax_export_batches
for update
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

grant select, insert, update on public.tax_export_batches to authenticated;
