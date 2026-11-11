-- Additive. Private scans of supplier invoices, linked after the user confirms.
-- Not applied by the application change. Back up production before running it.
-- Rollback is at the bottom of this file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-invoice-scans',
  'supplier-invoice-scans',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.supplier_invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  ocr_provider text,
  ocr_model text,
  field_confidence jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_invoice_attachments_org_idx
  on public.supplier_invoice_attachments (organization_id, supplier_invoice_id);

alter table public.supplier_invoice_attachments enable row level security;

drop policy if exists supplier_invoice_attachments_org_read on public.supplier_invoice_attachments;
create policy supplier_invoice_attachments_org_read
on public.supplier_invoice_attachments
for select
using (app_private.is_org_member(organization_id));

drop policy if exists supplier_invoice_attachments_org_insert on public.supplier_invoice_attachments;
create policy supplier_invoice_attachments_org_insert
on public.supplier_invoice_attachments
for insert
with check (
  app_private.is_org_member(organization_id)
  and exists (
    select 1 from public.supplier_invoices invoice
    where invoice.id = supplier_invoice_id
      and invoice.organization_id = supplier_invoice_attachments.organization_id
  )
);

drop policy if exists supplier_invoice_scans_read on storage.objects;
create policy supplier_invoice_scans_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'supplier-invoice-scans'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1 from public.organization_members member
    where member.organization_id::text = (storage.foldername(name))[2]
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists supplier_invoice_scans_insert on storage.objects;
create policy supplier_invoice_scans_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'supplier-invoice-scans'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members member
    join public.roles role on role.id = member.role_id
    where member.organization_id::text = (storage.foldername(name))[2]
      and member.user_id = auth.uid()
      and member.status = 'active'
      and role.name in ('owner', 'admin', 'operator', 'accountant')
  )
);

drop policy if exists supplier_invoice_scans_delete on storage.objects;
create policy supplier_invoice_scans_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'supplier-invoice-scans'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members member
    join public.roles role on role.id = member.role_id
    where member.organization_id::text = (storage.foldername(name))[2]
      and member.user_id = auth.uid()
      and member.status = 'active'
      and role.name in ('owner', 'admin', 'operator', 'accountant')
  )
);

-- Rollback (run only to remove this feature; it deletes stored scans):
-- drop policy if exists supplier_invoice_scans_read on storage.objects;
-- drop policy if exists supplier_invoice_scans_insert on storage.objects;
-- drop policy if exists supplier_invoice_scans_delete on storage.objects;
-- delete from storage.objects where bucket_id = 'supplier-invoice-scans';
-- delete from storage.buckets where id = 'supplier-invoice-scans';
-- drop policy if exists supplier_invoice_attachments_org_read on public.supplier_invoice_attachments;
-- drop policy if exists supplier_invoice_attachments_org_insert on public.supplier_invoice_attachments;
-- drop table if exists public.supplier_invoice_attachments;
