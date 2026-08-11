-- Felexia V3 tenant isolation and critical financial authorization.
-- Restrictive policies are additive: they narrow existing permissive policies
-- without deleting tenant-specific rules already deployed.

create schema if not exists app_private;

create or replace function app_private.has_active_org_membership(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function app_private.has_org_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
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
            'manager', 'responsable', 'gestionnaire', 'stock', 'magasinier'
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

revoke all on function app_private.has_active_org_membership(uuid) from public, anon;
revoke all on function app_private.has_org_permission(uuid, text) from public, anon;
grant execute on function app_private.has_active_org_membership(uuid) to authenticated;
grant execute on function app_private.has_org_permission(uuid, text) to authenticated;

do $$
declare
  tenant_table record;
begin
  for tenant_table in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    join pg_attribute attribute on attribute.attrelid = relation.oid
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
      and attribute.attname = 'organization_id'
      and not attribute.attisdropped
      and relation.relname not in ('organization_members', 'invitations')
  loop
    execute format(
      'drop policy if exists active_membership_guard_v3 on %I.%I',
      tenant_table.schema_name,
      tenant_table.table_name
    );
    execute format(
      'create policy active_membership_guard_v3 on %I.%I as restrictive for all to authenticated using (app_private.has_active_org_membership(organization_id)) with check (app_private.has_active_org_membership(organization_id))',
      tenant_table.schema_name,
      tenant_table.table_name
    );
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.stock_moves') is not null then
    drop policy if exists stock_moves_insert_guard_v3 on public.stock_moves;
    drop policy if exists stock_moves_immutable_update_v3 on public.stock_moves;
    drop policy if exists stock_moves_immutable_delete_v3 on public.stock_moves;
    create policy stock_moves_insert_guard_v3 on public.stock_moves
      as restrictive for insert to authenticated
      with check (app_private.has_org_permission(organization_id, 'stock.adjust'));
    create policy stock_moves_immutable_update_v3 on public.stock_moves
      as restrictive for update to authenticated using (false) with check (false);
    create policy stock_moves_immutable_delete_v3 on public.stock_moves
      as restrictive for delete to authenticated using (false);
  end if;

  if to_regclass('public.stock_levels') is not null then
    drop policy if exists stock_levels_insert_guard_v3 on public.stock_levels;
    drop policy if exists stock_levels_update_guard_v3 on public.stock_levels;
    drop policy if exists stock_levels_delete_guard_v3 on public.stock_levels;
    create policy stock_levels_insert_guard_v3 on public.stock_levels
      as restrictive for insert to authenticated
      with check (app_private.has_org_permission(organization_id, 'stock.adjust'));
    create policy stock_levels_update_guard_v3 on public.stock_levels
      as restrictive for update to authenticated
      using (app_private.has_org_permission(organization_id, 'stock.adjust'))
      with check (app_private.has_org_permission(organization_id, 'stock.adjust'));
    create policy stock_levels_delete_guard_v3 on public.stock_levels
      as restrictive for delete to authenticated using (false);
  end if;

  if to_regclass('public.products') is not null then
    drop policy if exists products_insert_guard_v3 on public.products;
    drop policy if exists products_update_guard_v3 on public.products;
    drop policy if exists products_delete_guard_v3 on public.products;
    create policy products_insert_guard_v3 on public.products
      as restrictive for insert to authenticated
      with check (app_private.has_org_permission(organization_id, 'items.create'));
    create policy products_update_guard_v3 on public.products
      as restrictive for update to authenticated
      using (
        app_private.has_org_permission(organization_id, 'items.update')
        or app_private.has_org_permission(organization_id, 'stock.adjust')
      )
      with check (
        app_private.has_org_permission(organization_id, 'items.update')
        or app_private.has_org_permission(organization_id, 'stock.adjust')
      );
    create policy products_delete_guard_v3 on public.products
      as restrictive for delete to authenticated
      using (app_private.has_org_permission(organization_id, 'items.delete'));
  end if;
end;
$$;

-- Critical financial tables need an additional write permission. Read access
-- remains governed by the existing tenant policies and the active-member guard.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'customer_payments',
    'customer_payment_allocations',
    'supplier_payments',
    'supplier_payment_allocations',
    'treasury_accounts',
    'treasury_transactions'
  ]
  loop
    if to_regclass('public.' || target_table) is null then continue; end if;

    execute format('drop policy if exists financial_insert_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists financial_update_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists financial_delete_guard_v3 on public.%I', target_table);

    execute format(
      'create policy financial_insert_guard_v3 on public.%I as restrictive for insert to authenticated with check (app_private.has_org_permission(organization_id, ''treasury.create_payment''))',
      target_table
    );
    execute format(
      'create policy financial_update_guard_v3 on public.%I as restrictive for update to authenticated using (app_private.has_org_permission(organization_id, ''treasury.create_payment'') or app_private.has_org_permission(organization_id, ''treasury.reconcile'') or app_private.has_org_permission(organization_id, ''treasury.delete'')) with check (app_private.has_org_permission(organization_id, ''treasury.create_payment'') or app_private.has_org_permission(organization_id, ''treasury.reconcile'') or app_private.has_org_permission(organization_id, ''treasury.delete''))',
      target_table
    );
    execute format(
      'create policy financial_delete_guard_v3 on public.%I as restrictive for delete to authenticated using (app_private.has_org_permission(organization_id, ''treasury.delete''))',
      target_table
    );
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'bank_statement_imports',
    'bank_statement_lines',
    'bank_reconciliations'
  ]
  loop
    if to_regclass('public.' || target_table) is null then continue; end if;
    execute format('drop policy if exists reconciliation_insert_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists reconciliation_update_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists reconciliation_delete_guard_v3 on public.%I', target_table);
    execute format(
      'create policy reconciliation_insert_guard_v3 on public.%I as restrictive for insert to authenticated with check (app_private.has_org_permission(organization_id, ''treasury.reconcile''))',
      target_table
    );
    execute format(
      'create policy reconciliation_update_guard_v3 on public.%I as restrictive for update to authenticated using (app_private.has_org_permission(organization_id, ''treasury.reconcile'')) with check (app_private.has_org_permission(organization_id, ''treasury.reconcile''))',
      target_table
    );
    execute format(
      'create policy reconciliation_delete_guard_v3 on public.%I as restrictive for delete to authenticated using (app_private.has_org_permission(organization_id, ''treasury.reconcile''))',
      target_table
    );
  end loop;
end;
$$;
