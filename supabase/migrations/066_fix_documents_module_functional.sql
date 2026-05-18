alter table public.documents
  add column if not exists uploaded_by uuid null references public.profiles(id) on delete set null,
  add column if not exists title text null,
  add column if not exists original_name text null,
  add column if not exists file_name text null,
  add column if not exists size_bytes bigint null,
  add column if not exists category text null,
  add column if not exists source_id uuid null,
  add column if not exists notes text null;

update public.documents
set
  title = coalesce(title, name),
  original_name = coalesce(original_name, name),
  file_name = coalesce(file_name, name),
  size_bytes = coalesce(size_bytes, file_size),
  category = coalesce(category, document_type),
  notes = coalesce(notes, description)
where title is null
   or original_name is null
   or file_name is null
   or size_bytes is null
   or category is null
   or notes is null;

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('active', 'archived', 'available', 'draft', 'validated', 'deleted'));

alter table public.documents
  drop constraint if exists documents_file_path_not_empty;

alter table public.documents
  add constraint documents_file_path_not_empty
  check (file_path is null or length(btrim(file_path)) > 0);

alter table public.documents
  drop constraint if exists documents_title_not_empty;

alter table public.documents
  add constraint documents_title_not_empty
  check (title is null or length(btrim(title)) > 0);

create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists documents_category_idx on public.documents (category);
create index if not exists documents_source_id_idx on public.documents (source_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-documents',
  'organization-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];

alter table public.documents enable row level security;

drop policy if exists documents_org_member_all on public.documents;
drop policy if exists documents_select_org_members on public.documents;
drop policy if exists documents_insert_org_members on public.documents;
drop policy if exists documents_update_org_members on public.documents;
drop policy if exists documents_delete_org_admins on public.documents;

create policy documents_select_org_members
on public.documents
for select
to authenticated
using (app_private.is_org_member(organization_id));

create policy documents_insert_org_members
on public.documents
for insert
to authenticated
with check (app_private.is_org_member(organization_id));

create policy documents_update_org_members
on public.documents
for update
to authenticated
using (
  app_private.is_org_member(organization_id)
  and (
    uploaded_by = auth.uid()
    or exists (
      select 1
      from public.organization_members om
      left join public.roles r on r.id = om.role_id
      where om.organization_id = documents.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur')
    )
  )
)
with check (app_private.is_org_member(organization_id));

create policy documents_delete_org_admins
on public.documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    left join public.roles r on r.id = om.role_id
    where om.organization_id = documents.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur')
  )
);

drop policy if exists organization_documents_read on storage.objects;
drop policy if exists organization_documents_insert on storage.objects;
drop policy if exists organization_documents_update on storage.objects;
drop policy if exists organization_documents_delete on storage.objects;

create policy organization_documents_read
on storage.objects
for select
to authenticated
using (bucket_id = 'organization-documents');

create policy organization_documents_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'organization-documents');

create policy organization_documents_update
on storage.objects
for update
to authenticated
using (bucket_id = 'organization-documents')
with check (bucket_id = 'organization-documents');

create policy organization_documents_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'organization-documents');
