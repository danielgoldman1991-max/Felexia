-- 114: let the commercial operator adjust stock on a PRO company.
-- Applied locally only until the owner approves a production run.
-- Does not edit migrations 112 or 113.

create or replace function app_private.has_org_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_members membership
    left join public.roles role on role.id = membership.role_id
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (
        lower(coalesce(role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
        or (
          p_permission_code like 'treasury.%'
          and lower(coalesce(role.name, '')) in (
            'manager', 'responsable', 'gestionnaire', 'accountant', 'comptable'
          )
        )
        or (
          p_permission_code like 'stock.%'
          and lower(coalesce(role.name, '')) in (
            'manager', 'responsable', 'gestionnaire', 'stock', 'magasinier',
            'operator', 'operateur', 'opérateur'
          )
        )
        or (
          p_permission_code like 'items.%'
          and lower(coalesce(role.name, '')) in (
            'manager', 'responsable', 'gestionnaire', 'stock', 'magasinier'
          )
        )
        or exists (
          select 1
          from public.role_permissions role_permission
          join public.permissions permission on permission.id = role_permission.permission_id
          where role_permission.role_id = membership.role_id
            and permission.code = p_permission_code
        )
      )
  );
$$;

revoke all on function app_private.has_org_permission(uuid, text) from public, anon;
grant execute on function app_private.has_org_permission(uuid, text) to authenticated, service_role;
