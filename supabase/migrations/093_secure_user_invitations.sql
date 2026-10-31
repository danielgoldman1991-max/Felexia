-- 093_secure_user_invitations.sql
-- ============================================================================
-- Workflow d'invitation Supabase (inviteUserByEmail) + durcissement RLS
-- multi-tenant de la gestion des utilisateurs.
--
-- Objectifs :
--  1. Invitations liées à l'utilisateur Supabase créé (auth_user_id),
--     colonnes manquantes (full_name, invited_at) — ADDITIF, ne casse rien.
--  2. RLS : seul un ADMINISTRATEUR de l'organisation peut écrire sur
--     organization_members / invitations / roles / role_permissions.
--     Les lectures restent ouvertes à tous les membres actifs de l'organisa-
--     tion (is_org_member) — un admin de Société A ne peut ni voir, ni
--     inviter, ni modifier les utilisateurs de Société B (cross-tenant).
--  3. RPC atomique app_private.accept_invitation_for_user : crée le
--     membership (pending → accepted → active user) en une seule opération
--     security definer, sans casser la FK organization_members.user_id ->
--     profiles.id (l'utilisateur existe déjà via l'invitation Supabase).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. invitations : colonnes additionnelles + index
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists full_name text,
  add column if not exists invited_at timestamptz;

create index if not exists invitations_auth_user_id_idx on public.invitations (auth_user_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers sécurité
-- ---------------------------------------------------------------------------
create or replace function app_private.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_members member
    left join public.roles member_role on member_role.id = member.role_id
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  );
$$;

revoke all on function app_private.is_org_admin(uuid) from public, anon;
grant execute on function app_private.is_org_admin(uuid) to authenticated;

-- L'utilisateur est-il administrateur de l'organisation qui possède ce rôle ?
create or replace function app_private.is_org_admin_of_role(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.roles target_role
    join public.organization_members member
      on member.organization_id = target_role.organization_id
     and member.user_id = auth.uid()
     and member.status = 'active'
    left join public.roles member_role on member_role.id = member.role_id
    where target_role.id = p_role_id
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  );
$$;

revoke all on function app_private.is_org_admin_of_role(uuid) from public, anon;
grant execute on function app_private.is_org_admin_of_role(uuid) to authenticated;

-- L'utilisateur est-il membre actif de l'organisation qui possède ce rôle ?
create or replace function app_private.is_org_member_of_role(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.roles target_role
    join public.organization_members member
      on member.organization_id = target_role.organization_id
     and member.user_id = auth.uid()
     and member.status = 'active'
    where target_role.id = p_role_id
  );
$$;

revoke all on function app_private.is_org_member_of_role(uuid) from public, anon;
grant execute on function app_private.is_org_member_of_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. organization_members : ÉCRITURE réservée aux admins de l'organisation
--    (restrictive guards — s'ajoutent aux politiques permissives existantes).
--    Empêche un membre "viewer" de modifier son propre rôle (escalade) ou les
--    membres d'une autre organisation (cross-tenant).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'organization_members'
      and p.polname = 'organization_members_insert_guard_v3'
  ) then
    create policy organization_members_insert_guard_v3
      on public.organization_members as restrictive
      for insert to authenticated
      with check (app_private.is_org_admin(organization_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'organization_members'
      and p.polname = 'organization_members_update_guard_v3'
  ) then
    create policy organization_members_update_guard_v3
      on public.organization_members as restrictive
      for update to authenticated
      using (app_private.is_org_admin(organization_id))
      with check (app_private.is_org_admin(organization_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'organization_members'
      and p.polname = 'organization_members_delete_guard_v3'
  ) then
    create policy organization_members_delete_guard_v3
      on public.organization_members as restrictive
      for delete to authenticated
      using (app_private.is_org_admin(organization_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. invitations : INSERT / UPDATE réservés aux admins de l'organisation
--    (remplace les anciennes policies ouvertes à tout membre actif).
--    SELECT reste ouvert à tout membre actif de la MÊME organisation.
-- ---------------------------------------------------------------------------
drop policy if exists invitations_org_admin_insert on public.invitations;
create policy invitations_org_admin_insert
  on public.invitations
  for insert to authenticated
  with check (app_private.is_org_admin(organization_id));

drop policy if exists invitations_org_admin_update on public.invitations;
create policy invitations_org_admin_update
  on public.invitations
  for update to authenticated
  using (app_private.is_org_admin(organization_id))
  with check (app_private.is_org_admin(organization_id));

-- Invitation tokens are credentials: ordinary members never read them.
drop policy if exists invitations_org_member_select on public.invitations;
create policy invitations_org_member_select on public.invitations
  for select to authenticated
  using (app_private.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- 5. roles : INSERT / UPDATE / DELETE réservés aux admins de l'organisation
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'roles'
      and p.polname = 'roles_insert_guard_v3'
  ) then
    create policy roles_insert_guard_v3
      on public.roles as restrictive
      for insert to authenticated
      with check (app_private.is_org_admin(organization_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'roles'
      and p.polname = 'roles_update_guard_v3'
  ) then
    create policy roles_update_guard_v3
      on public.roles as restrictive
      for update to authenticated
      using (app_private.is_org_admin(organization_id))
      with check (app_private.is_org_admin(organization_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'roles'
      and p.polname = 'roles_delete_guard_v3'
  ) then
    create policy roles_delete_guard_v3
      on public.roles as restrictive
      for delete to authenticated
      using (app_private.is_org_admin(organization_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. role_permissions + permissions : RLS (actuellement AUCUNE — escalation
--    totale possible). Écriture admin de l'org propriétaire du rôle, lecture
--    membre actif de la même org.
-- ---------------------------------------------------------------------------
alter table public.role_permissions enable row level security;

drop policy if exists role_permissions_select_org_member on public.role_permissions;
create policy role_permissions_select_org_member
  on public.role_permissions
  for select to authenticated
  using (app_private.is_org_member_of_role(role_id));

do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'role_permissions'
      and p.polname = 'role_permissions_insert_guard_v3'
  ) then
    create policy role_permissions_insert_guard_v3
      on public.role_permissions as restrictive
      for insert to authenticated
      with check (app_private.is_org_admin_of_role(role_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'role_permissions'
      and p.polname = 'role_permissions_update_guard_v3'
  ) then
    create policy role_permissions_update_guard_v3
      on public.role_permissions as restrictive
      for update to authenticated
      using (app_private.is_org_admin_of_role(role_id))
      with check (app_private.is_org_admin_of_role(role_id));
  end if;
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'role_permissions'
      and p.polname = 'role_permissions_delete_guard_v3'
  ) then
    create policy role_permissions_delete_guard_v3
      on public.role_permissions as restrictive
      for delete to authenticated
      using (app_private.is_org_admin_of_role(role_id));
  end if;
end $$;

-- permissions : catalogue global — lecture pour tous les autentifiés,
-- aucune écriture depuis PostgREST (service role uniquement).
alter table public.permissions enable row level security;

drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated
  on public.permissions
  for select to authenticated
  using (true);

-- Restrictive guards need a permissive write policy as well.
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions
  for all to authenticated
  using (app_private.is_org_admin_of_role(role_id))
  with check (app_private.is_org_admin_of_role(role_id));

-- ---------------------------------------------------------------------------
-- 7. RPC atomique d'acceptation d'invitation
--    pending → accepted → membre actif, en une seule opération.
--    - Vérifie le token ET que l'email du compte correspond à l'invitation.
--    - Rejeu idempotent, sans modification d'un membership préexistant.
--    - Ne modifie jamais organization_id depuis l'appelant.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation_for_user(
  p_token text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_invitation record;
  v_user_email text;
  v_role_id uuid;
  v_limit integer;
  v_count integer;
begin
  -- The caller must own the authenticated, verified account being attached.
  if auth.uid() is null or auth.uid() <> p_user_id then
    return false;
  end if;

  select id, organization_id, email, role_id, status, expires_at, auth_user_id
    into v_invitation
    from public.invitations
   where token = p_token
   for update;

  if not found then
    return false;
  end if;

  -- L'email du compte doit correspondre EXACTEMENT à l'invitation
  -- (barrière anti cross-tenant : on ne rattache jamais un compte à une
  -- organisation via un token qu'il ne posséderait pas).
  select email into v_user_email from auth.users
    where id = p_user_id and email_confirmed_at is not null;
  if v_user_email is null or lower(v_user_email) <> lower(v_invitation.email) then
    return false;
  end if;

  if v_invitation.auth_user_id is not null and v_invitation.auth_user_id <> p_user_id then
    return false;
  end if;
  if v_invitation.status = 'accepted' then
    return exists (
      select 1 from public.organization_members
      where organization_id = v_invitation.organization_id
        and user_id = p_user_id and status = 'active'
    );
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    return false;
  end if;

  -- Serialize membership changes against reservations for the same company.
  perform 1 from public.organizations where id = v_invitation.organization_id for update;
  if exists (select 1 from public.organization_members
    where organization_id = v_invitation.organization_id and user_id = p_user_id) then
    -- An old invitation must never reactivate or replace an existing member's role.
    return false;
  end if;
  select coalesce(plan.max_users, 3) into v_limit
  from public.organization_subscriptions subscription
  left join public.subscription_plans plan on plan.code = subscription.plan_code
  where subscription.organization_id = v_invitation.organization_id
  order by subscription.created_at desc limit 1;
  v_limit := coalesce(v_limit, 3);
  select count(*) into v_count from public.organization_members
    where organization_id = v_invitation.organization_id and status = 'active';
  if v_count >= v_limit then return false; end if;

  v_role_id := v_invitation.role_id;
  if v_role_id is null then
    insert into public.roles (organization_id, name, description)
      values (v_invitation.organization_id, 'viewer', 'Lecture seule')
      on conflict (organization_id, name) do nothing;
    select id into v_role_id from public.roles
      where organization_id = v_invitation.organization_id and name = 'viewer';
  end if;
  if not exists (select 1 from public.roles
    where id = v_role_id and organization_id = v_invitation.organization_id) then
    return false;
  end if;

  -- The auth trigger normally creates this; repair only a missing profile.
  insert into public.profiles(id, email)
    values (p_user_id, v_user_email) on conflict (id) do nothing;

  -- Membership actif (l'utilisateur existe déjà via l'invitation Supabase,
  -- la FK user_id -> profiles.id est donc satisfaite).
  insert into public.organization_members (
    organization_id,
    user_id,
    role_id,
    status,
    created_at,
    updated_at
  )
  values (
    v_invitation.organization_id,
    p_user_id,
    v_role_id,
    'active',
    now(),
    now()
  );

  update public.invitations
     set status = 'accepted', auth_user_id = p_user_id, role_id = v_role_id, updated_at = now()
   where id = v_invitation.id;

  return true;
end;
$$;

revoke all on function public.accept_invitation_for_user(text, uuid) from public, anon;
grant execute on function public.accept_invitation_for_user(text, uuid) to authenticated;

-- Retire the old unauthenticated mutation functions, including an earlier 093.
do $$ begin
  if to_regprocedure('app_private.accept_invitation_for_user(text,uuid)') is not null then
    execute 'revoke all on function app_private.accept_invitation_for_user(text,uuid) from public, anon, authenticated';
  end if;
  if to_regprocedure('app_private.accept_invitation(text)') is not null then
    execute 'revoke all on function app_private.accept_invitation(text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.accept_invitation(text)') is not null then
    execute 'revoke all on function public.accept_invitation(text) from public, anon, authenticated';
  end if;
end $$;

-- A token grants only a limited preview; it never creates a membership.
create or replace function public.get_invitation_by_token(p_token text)
returns table (id uuid, organization_id uuid, organization_name text, email text,
  role_id uuid, status text, expires_at timestamptz)
language sql stable security definer set search_path = public, app_private
as $$
  select i.id, i.organization_id, o.name, i.email, i.role_id, i.status, i.expires_at
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;
revoke all on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- Reserve capacity before sending email. The organization lock prevents two
-- simultaneous invitations from exceeding the plan or duplicating an address.
create or replace function public.reserve_organization_invitation(
  p_id uuid, p_organization_id uuid, p_email text, p_role_id uuid,
  p_full_name text, p_token text
)
returns uuid language plpgsql security definer set search_path = public, app_private
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if auth.uid() is null or not app_private.is_org_admin(p_organization_id) then
    raise exception 'INVITATION_FORBIDDEN';
  end if;
  perform 1 from public.organizations where id = p_organization_id for update;
  if not exists (select 1 from public.roles
    where id = p_role_id and organization_id = p_organization_id) then
    raise exception 'INVITATION_INVALID_ROLE';
  end if;
  if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_token is null or length(p_token) < 64 then
    raise exception 'INVITATION_INVALID_INPUT';
  end if;
  if exists (select 1 from public.profiles profile
    join public.organization_members member on member.user_id = profile.id
    where member.organization_id = p_organization_id and lower(profile.email) = lower(trim(p_email))) then
    raise exception 'INVITATION_MEMBER_EXISTS';
  end if;
  if exists (select 1 from public.invitations
    where organization_id = p_organization_id and lower(email) = lower(trim(p_email))
      and status = 'pending' and expires_at > now()) then
    raise exception 'INVITATION_PENDING';
  end if;
  select coalesce(plan.max_users, 3) into v_limit
  from public.organization_subscriptions subscription
  left join public.subscription_plans plan on plan.code = subscription.plan_code
  where subscription.organization_id = p_organization_id
  order by subscription.created_at desc limit 1;
  v_limit := coalesce(v_limit, 3);
  select (select count(*) from public.organization_members
      where organization_id = p_organization_id and status = 'active')
    + (select count(*) from public.invitations where organization_id = p_organization_id
      and status = 'pending' and expires_at > now()) into v_count;
  if v_count >= v_limit then raise exception 'INVITATION_USER_LIMIT'; end if;
  insert into public.invitations(id, organization_id, email, role_id, invited_by,
    token, expires_at, full_name, status)
  values (p_id, p_organization_id, lower(trim(p_email)), p_role_id, auth.uid(),
    p_token, now() + interval '7 days', nullif(trim(p_full_name), ''), 'pending');
  return p_id;
end;
$$;
revoke all on function public.reserve_organization_invitation(uuid, uuid, text, uuid, text, text) from public, anon;
grant execute on function public.reserve_organization_invitation(uuid, uuid, text, uuid, text, text) to authenticated;
