-- 094: enforce consultation-only finance access after the live viewer JWT probe.
-- Additive denial of writes for the existing read-only role. Existing V3
-- permissions and every non-viewer role's previous grants remain in force.
begin;

create or replace function app_private.is_read_only_org_member(p_organization_id uuid)
returns boolean language sql stable security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members membership
    join public.roles role on role.id = membership.role_id
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and lower(btrim(role.name)) in ('viewer', 'lecture seule', 'lecteur', 'readonly', 'read_only')
  );
$$;

revoke all on function app_private.is_read_only_org_member(uuid) from public, anon;
grant execute on function app_private.is_read_only_org_member(uuid) to authenticated;

do $$
declare
  target_table text;
  v_rls_enabled boolean;
begin
  foreach target_table in array array[
    'customer_invoices', 'customer_invoice_lines',
    'supplier_invoices', 'supplier_invoice_lines',
    'customer_payments', 'customer_payment_allocations',
    'supplier_payments', 'supplier_payment_allocations',
    'treasury_accounts', 'treasury_transactions',
    'accounting_entries', 'accounting_entry_lines', 'accounting_journals',
    'accounting_accounts', 'accounting_settings',
    'third_parties', 'company_settings'
  ]
  loop
    if to_regclass('public.' || target_table) is null then continue; end if;
    select relrowsecurity into v_rls_enabled from pg_class
      where oid = to_regclass('public.' || target_table);
    if not v_rls_enabled then
      -- Do not silently leave a table unprotected or create new permissive
      -- access rules. Its existing access model needs explicit review first.
      raise exception 'RLS_DISABLED_REQUIRES_REVIEW: %', target_table;
    end if;
    execute format('drop policy if exists readonly_finance_insert_guard_v4 on public.%I', target_table);
    execute format('drop policy if exists readonly_finance_update_guard_v4 on public.%I', target_table);
    execute format('drop policy if exists readonly_finance_delete_guard_v4 on public.%I', target_table);
    execute format(
      'create policy readonly_finance_insert_guard_v4 on public.%I as restrictive for insert to authenticated with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))', target_table
    );
    execute format(
      'create policy readonly_finance_update_guard_v4 on public.%I as restrictive for update to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)) with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))', target_table
    );
    execute format(
      'create policy readonly_finance_delete_guard_v4 on public.%I as restrictive for delete to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))', target_table
    );
  end loop;
end;
$$;

commit;
