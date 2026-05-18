create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  document_type text not null,
  origin text not null default 'generated',
  source_module text null,
  linked_reference text null,
  linked_entity_type text null,
  linked_entity_id uuid null,
  file_url text null,
  file_path text null,
  mime_type text null,
  file_size bigint null,
  document_date date null,
  status text not null default 'available',
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  deleted_at timestamptz null,
  constraint documents_document_type_check check (
    document_type in (
      'quote',
      'customer_order',
      'delivery_note',
      'customer_invoice',
      'customer_credit_note',
      'supplier_order',
      'supplier_receipt',
      'supplier_invoice',
      'supplier_credit_note',
      'payment_receipt',
      'imported_document',
      'other'
    )
  ),
  constraint documents_origin_check check (origin in ('generated', 'manual_import', 'exported', 'archived')),
  constraint documents_status_check check (status in ('available', 'draft', 'validated', 'archived', 'deleted')),
  constraint documents_file_size_check check (file_size is null or file_size >= 0),
  constraint documents_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists documents_organization_id_idx on public.documents (organization_id);
create index if not exists documents_document_type_idx on public.documents (document_type);
create index if not exists documents_source_module_idx on public.documents (source_module);
create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_document_date_idx on public.documents (document_date);
create index if not exists documents_created_at_idx on public.documents (created_at);
create index if not exists documents_archived_at_idx on public.documents (archived_at);
create index if not exists documents_deleted_at_idx on public.documents (deleted_at);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists documents_org_member_all on public.documents;
create policy documents_org_member_all
on public.documents
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

grant select, insert, update, delete on public.documents to authenticated;
