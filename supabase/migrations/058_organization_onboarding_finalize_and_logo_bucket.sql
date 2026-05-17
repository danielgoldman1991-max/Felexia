create or replace function public.finalize_organization_onboarding(
  p_organization_id uuid,
  p_name text,
  p_address text,
  p_city text,
  p_phone text,
  p_email text,
  p_currency text default 'MAD',
  p_logo_url text default null,
  p_logo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Vous devez etre connecte pour configurer une entreprise.';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise exception 'Vous n''avez pas acces a cette entreprise.';
  end if;

  update public.organizations
  set
    name = trim(p_name),
    legal_name = trim(p_name),
    address = trim(p_address),
    city = trim(p_city),
    phone = trim(p_phone),
    email = lower(trim(p_email)),
    currency = 'MAD',
    ice = null,
    logo_url = coalesce(p_logo_url, logo_url),
    logo_path = coalesce(p_logo_path, logo_path),
    updated_at = now()
  where id = p_organization_id;

  insert into public.company_settings (
    organization_id,
    legal_name,
    ice,
    address,
    city,
    phone,
    email,
    currency,
    logo_url,
    logo_path,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    trim(p_name),
    null,
    trim(p_address),
    trim(p_city),
    trim(p_phone),
    lower(trim(p_email)),
    'MAD',
    p_logo_url,
    p_logo_path,
    now(),
    now()
  )
  on conflict (organization_id) do update
  set
    legal_name = excluded.legal_name,
    ice = null,
    address = excluded.address,
    city = excluded.city,
    phone = excluded.phone,
    email = excluded.email,
    currency = 'MAD',
    logo_url = coalesce(excluded.logo_url, public.company_settings.logo_url),
    logo_path = coalesce(excluded.logo_path, public.company_settings.logo_path),
    updated_at = now();

  update public.profiles
  set default_organization_id = p_organization_id,
      updated_at = now()
  where id = v_user_id;

  return p_organization_id;
end;
$$;

grant execute on function public.finalize_organization_onboarding(uuid, text, text, text, text, text, text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  array['image/png', 'image/jpg', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_logos_public_read on storage.objects;
create policy organization_logos_public_read
on storage.objects
for select
using (bucket_id = 'organization-logos');

drop policy if exists organization_logos_member_insert on storage.objects;
create policy organization_logos_member_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[2]
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists organization_logos_member_update on storage.objects;
create policy organization_logos_member_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'organization-logos'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[2]
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
)
with check (
  bucket_id = 'organization-logos'
  and (storage.foldername(name))[1] = 'organizations'
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[2]
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);
