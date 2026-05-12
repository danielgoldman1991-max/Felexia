-- SECURITY DEFINER RPC for organization onboarding.
-- Creates an organization, admin role, and links the authenticated user
-- as an active admin member in one atomic operation.
--
-- This bypasses RLS safely (runs as function owner) to avoid the
-- chicken-and-egg problem: a new user has no org membership yet, so
-- RLS policies using is_org_member() would block all inserts.
--
-- It also ensures a profiles row exists for the user (organization_members.user_id
-- references profiles.id, not auth.users.id directly).

drop function if exists public.create_organization_with_owner;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_slug text,
  p_admin_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_organization_id uuid;
  v_role_id uuid;
begin
  -- 1. Must be authenticated
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Vous devez etre connecte pour creer une entreprise.';
  end if;

  -- 2. Fetch email from auth.users
  select email into v_email
  from auth.users
  where id = v_user_id;

  -- 3. Slug uniqueness check
  if exists (select 1 from organizations where slug = p_slug) then
    raise exception 'Cet identifiant d''entreprise existe deja. Veuillez en choisir un autre.';
  end if;

  -- 4. Ensure profiles row exists (FK target for organization_members)
  insert into profiles (id, full_name, email, created_at, updated_at)
  values (v_user_id, p_admin_name, v_email, now(), now())
  on conflict (id) do update
  set full_name = coalesce(profiles.full_name, excluded.full_name),
      email = coalesce(profiles.email, excluded.email),
      updated_at = now();

  -- 5. Create the organization
  insert into organizations (name, slug)
  values (trim(p_name), trim(p_slug))
  returning id into v_organization_id;

  -- 6. Create an admin role for this org
  insert into roles (organization_id, name, description)
  values (v_organization_id, 'admin', 'Administrateur')
  returning id into v_role_id;

  -- 7. Link user as active admin member
  insert into organization_members (organization_id, user_id, role_id, status)
  values (v_organization_id, v_user_id, v_role_id, 'active');

  return v_organization_id;
end;
$$;

grant execute on function public.create_organization_with_owner(text, text, text) to authenticated;
-- The 2-arg call (p_admin_name omitted) is also covered due to the default parameter.
