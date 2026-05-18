alter table public.tax_export_batches
add column if not exists regime text null;

alter table public.tax_export_batches
add column if not exists file_url text null;

alter table public.tax_export_batches
add column if not exists controls_summary jsonb null;

alter table public.tax_export_batches
add column if not exists totals jsonb null;

alter table public.tax_export_batches
add column if not exists updated_at timestamptz not null default now();

alter table public.tax_export_batches
alter column export_type set default 'dgi_vat_preparation';

alter table public.tax_export_batches
alter column format set default 'csv';

do $$
begin
  alter table public.tax_export_batches drop constraint if exists tax_export_batches_status_check;
  alter table public.tax_export_batches
    add constraint tax_export_batches_status_check
    check (status in ('draft', 'previewed', 'blocked', 'generated', 'generated_with_warnings', 'ready', 'downloaded', 'archived', 'failed'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.tax_export_batches drop constraint if exists tax_export_batches_format_check;
  alter table public.tax_export_batches
    add constraint tax_export_batches_format_check
    check (format in ('csv', 'xlsx', 'excel', 'dgi', 'zip', 'pdf'));
exception
  when duplicate_object then null;
end $$;

create index if not exists tax_export_batches_regime_idx
on public.tax_export_batches (regime);

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
  20971520,
  array[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ];

drop policy if exists "Authenticated users can read tax exports" on storage.objects;
create policy "Authenticated users can read tax exports"
on storage.objects
for select
to authenticated
using (bucket_id = 'tax-exports');

drop policy if exists "Authenticated users can upload tax exports" on storage.objects;
create policy "Authenticated users can upload tax exports"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'tax-exports');

drop policy if exists "Authenticated users can update tax exports" on storage.objects;
create policy "Authenticated users can update tax exports"
on storage.objects
for update
to authenticated
using (bucket_id = 'tax-exports')
with check (bucket_id = 'tax-exports');

drop policy if exists "Authenticated users can delete tax exports" on storage.objects;
create policy "Authenticated users can delete tax exports"
on storage.objects
for delete
to authenticated
using (bucket_id = 'tax-exports');

grant select, insert, update on public.tax_export_batches to authenticated;
