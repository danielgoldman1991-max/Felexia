alter table public.organizations
  add column if not exists logo_url text null;

alter table public.organizations
  add column if not exists logo_path text null;

alter table public.organizations
  add column if not exists updated_at timestamptz default now();

alter table public.company_settings
  add column if not exists logo_url text null;

alter table public.company_settings
  add column if not exists logo_path text null;

alter table public.company_settings
  add column if not exists updated_at timestamptz default now();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

create or replace function public.set_organization_logo(
  p_organization_id uuid,
  p_logo_url text,
  p_logo_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Vous devez etre connecte pour modifier le logo.';
  end if;

  select r.name into v_role_name
  from public.organization_members om
  left join public.roles r on r.id = om.role_id
  where om.organization_id = p_organization_id
    and om.user_id = v_user_id
    and coalesce(om.status, 'active') = 'active'
  limit 1;

  if lower(coalesce(v_role_name, '')) not in ('owner', 'admin', 'administrator', 'administrateur') then
    raise exception 'Vous n''etes pas autorise a modifier le logo de cette organisation.';
  end if;

  update public.organizations
  set
    logo_url = p_logo_url,
    logo_path = p_logo_path,
    updated_at = now()
  where id = p_organization_id;

  insert into public.company_settings (
    organization_id,
    legal_name,
    logo_url,
    logo_path,
    created_at,
    updated_at
  )
  select
    o.id,
    o.name,
    p_logo_url,
    p_logo_path,
    now(),
    now()
  from public.organizations o
  where o.id = p_organization_id
  on conflict (organization_id) do update
  set
    logo_url = excluded.logo_url,
    logo_path = excluded.logo_path,
    updated_at = now();

  return p_organization_id;
end;
$$;

grant execute on function public.set_organization_logo(uuid, text, text) to authenticated;

drop policy if exists organization_logos_public_read on storage.objects;
drop policy if exists organization_logos_member_insert on storage.objects;
drop policy if exists organization_logos_member_update on storage.objects;
drop policy if exists organization_logos_member_delete on storage.objects;
drop policy if exists "Organization logos are publicly readable" on storage.objects;
drop policy if exists "Authenticated users can upload organization logos" on storage.objects;
drop policy if exists "Authenticated users can update organization logos" on storage.objects;
drop policy if exists "Authenticated users can delete organization logos" on storage.objects;

create policy "Organization logos are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'organization-logos');

create policy "Authenticated users can upload organization logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'organization-logos');

create policy "Authenticated users can update organization logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'organization-logos')
with check (bucket_id = 'organization-logos');

create policy "Authenticated users can delete organization logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'organization-logos');

notify pgrst, 'reload schema';
