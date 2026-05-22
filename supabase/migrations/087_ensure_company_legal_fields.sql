-- Migration 087: ensure all legal fields exist in company_settings
-- and update finalize_organization_onboarding RPC to set all fields.
--
-- This prevents the client-side upsert from failing when columns are missing
-- due to incomplete migration history.

-- 1. Ensure all legalPayload columns exist in company_settings
alter table public.company_settings
  add column if not exists commercial_name text;

alter table public.company_settings
  add column if not exists rc text;

alter table public.company_settings
  add column if not exists if_number text;

alter table public.company_settings
  add column if not exists tax_identifier text;

alter table public.company_settings
  add column if not exists cnss text;

alter table public.company_settings
  add column if not exists forme_juridique text;

alter table public.company_settings
  add column if not exists ville_rc text;

alter table public.company_settings
  add column if not exists website text;

alter table public.company_settings
  add column if not exists activity text;

alter table public.company_settings
  add column if not exists phone text;

alter table public.company_settings
  add column if not exists email text;

alter table public.company_settings
  add column if not exists logo_url text;

alter table public.company_settings
  add column if not exists logo_path text;

-- 2. Ensure matching columns in organizations
alter table public.organizations
  add column if not exists legal_name text;

alter table public.organizations
  add column if not exists commercial_name text;

alter table public.organizations
  add column if not exists rc text;

alter table public.organizations
  add column if not exists if_number text;

alter table public.organizations
  add column if not exists tax_identifier text;

alter table public.organizations
  add column if not exists cnss text;

alter table public.organizations
  add column if not exists forme_juridique text;

alter table public.organizations
  add column if not exists ville_rc text;

alter table public.organizations
  add column if not exists website text;

alter table public.organizations
  add column if not exists activity text;

alter table public.organizations
  add column if not exists currency text default 'MAD';

alter table public.organizations
  add column if not exists logo_path text;

alter table public.organizations
  add column if not exists onboarding_step text;

alter table public.organizations
  add column if not exists onboarding_completed boolean default false;

alter table public.organizations
  add column if not exists onboarding_completed_at timestamptz;

-- 3. Update finalize_organization_onboarding to set ALL legal fields
--    in one atomic SECURITY DEFINER operation, eliminating the need for
--    a subsequent client-side upsert.
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
    commercial_name = trim(p_name),
    address = trim(p_address),
    city = trim(p_city),
    phone = trim(p_phone),
    email = lower(trim(p_email)),
    currency = 'MAD',
    ice = null,
    rc = null,
    if_number = null,
    tax_identifier = null,
    cnss = null,
    forme_juridique = null,
    ville_rc = null,
    website = null,
    activity = null,
    logo_url = coalesce(p_logo_url, logo_url),
    logo_path = coalesce(p_logo_path, logo_path),
    onboarding_completed = true,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now()
  where id = p_organization_id;

  if not found then
    raise exception 'Entreprise introuvable.';
  end if;

  insert into public.company_settings (
    organization_id,
    legal_name,
    commercial_name,
    ice,
    rc,
    if_number,
    tax_identifier,
    cnss,
    forme_juridique,
    ville_rc,
    address,
    city,
    phone,
    email,
    website,
    activity,
    currency,
    logo_url,
    logo_path,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    trim(p_name),
    trim(p_name),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    trim(p_address),
    trim(p_city),
    trim(p_phone),
    lower(trim(p_email)),
    null,
    null,
    'MAD',
    p_logo_url,
    p_logo_path,
    now(),
    now()
  )
  on conflict (organization_id) do update
  set
    legal_name = excluded.legal_name,
    commercial_name = excluded.commercial_name,
    ice = null,
    rc = null,
    if_number = null,
    tax_identifier = null,
    cnss = null,
    forme_juridique = null,
    ville_rc = null,
    address = excluded.address,
    city = excluded.city,
    phone = excluded.phone,
    email = excluded.email,
    website = null,
    activity = null,
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

notify pgrst, 'reload schema';
