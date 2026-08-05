-- Migration 088: Fix anonymous invitation acceptance
--
-- RLS on `invitations` only lets org members SELECT/UPDATE rows
-- (invitations_org_member_select / invitations_org_admin_update).
-- The public invite flow (/invitation?token=..., /api/invitations/accept)
-- is used by users without a session, so those queries were always denied
-- and every invitation was reported as "invalide ou expirée".
--
-- Fix: token-gated security definer functions. Access requires the
-- random 256-bit token generated at creation (crypto.randomBytes(32))
-- — no row is ever exposed without the token.

grant usage on schema app_private to anon;

-- Returns the invitation (with org name) for a given token.
-- Caller must hold the token; status/expiry are returned so the app
-- can distinguish "invalid" from "expired".
create or replace function app_private.get_invitation_by_token(p_token text)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  email text,
  role_id uuid,
  status text,
  expires_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select i.id, i.organization_id, o.name, i.email, i.role_id, i.status, i.expires_at
  from invitations i
  join organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;

-- Marks an invitation accepted when still pending and unexpired.
-- Returns true only if the transition actually happened.
create or replace function app_private.accept_invitation(p_token text)
returns boolean
language sql security definer set search_path = public
as $$
  update invitations
     set status = 'accepted', updated_at = now()
   where token = p_token
     and status = 'pending'
     and expires_at > now();
$$;

grant execute on function app_private.get_invitation_by_token(text) to anon, authenticated;
grant execute on function app_private.accept_invitation(text) to anon, authenticated;
