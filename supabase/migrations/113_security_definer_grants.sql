-- Advisor follow-up. Does not rewrite business data.
-- Apply after 112. Safe to apply on a database that already has 112.
--
-- Leaked-password protection is not a SQL change. Enable it in the Supabase
-- dashboard: Authentication → Providers → Email → Password security →
-- "Leaked password protection".

begin;

-- 1. Pin search_path on every public/app_private function that still has none.
do $$
declare fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.prokind = 'f'
      and (
        p.proconfig is null
        or not exists (
          select 1 from unnest(p.proconfig) as cfg
          where cfg like 'search_path=%'
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = pg_catalog, public, app_private, extensions',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
    raise notice 'search_path pinned on %.%(%)', fn.schema_name, fn.function_name, fn.identity_args;
  end loop;
end $$;

-- 2. Anonymous callers keep only the public invitation preview.
--    Signup, onboarding and cron use authenticated or service_role.
do $$
declare fn record;
  authenticated_had boolean;
  service_had boolean;
  keep_anon boolean;
begin
  for fn in
    select p.oid, n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    keep_anon := fn.schema_name = 'public'
      and fn.function_name = 'get_invitation_by_token'
      and fn.identity_args = 'p_token text';
    if keep_anon then
      continue;
    end if;
    authenticated_had := has_function_privilege('authenticated', fn.oid, 'execute');
    service_had := exists (select 1 from pg_roles where rolname = 'service_role')
      and has_function_privilege('service_role', fn.oid, 'execute');
    execute format(
      'revoke all on function %I.%I(%s) from public, anon',
      fn.schema_name, fn.function_name, fn.identity_args
    );
    if authenticated_had then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        fn.schema_name, fn.function_name, fn.identity_args
      );
    end if;
    if service_had then
      execute format(
        'grant execute on function %I.%I(%s) to service_role',
        fn.schema_name, fn.function_name, fn.identity_args
      );
    end if;
    raise notice 'anon execute revoked on %.%(%)', fn.schema_name, fn.function_name, fn.identity_args;
  end loop;
end $$;

-- 3. Authenticated execute stays on RPCs the app calls, on policy/view helpers,
--    and is removed everywhere else (including trigger-only functions).
do $$
declare fn record;
  keep_names text[] := array[
    'accept_invitation_for_user',
    'allocate_customer_payment_atomic',
    'allocate_supplier_payment_atomic',
    'apply_customer_credit_note_atomic',
    'apply_supplier_credit_note_atomic',
    'archive_treasury_transaction_atomic',
    'cancel_customer_payment_atomic',
    'cancel_supplier_payment_atomic',
    'convert_pro_quote_to_order_atomic',
    'correct_numbering_counter',
    'create_customer_payment_atomic',
    'create_organization_with_owner',
    'create_supplier_payment_atomic',
    'create_treasury_transaction_atomic',
    'create_treasury_transaction_from_statement_line_atomic',
    'create_treasury_transfer',
    'einvoice_capture_source',
    'einvoice_enqueue_simulation',
    'einvoice_get_artifact',
    'einvoice_get_capabilities',
    'einvoice_issue_and_archive',
    'einvoice_transition',
    'einvoice_update_settings',
    'ensure_essential_trial',
    'ensure_user_profile',
    'erp_get_capabilities',
    'finalize_organization_onboarding',
    'get_commercial_document_usage',
    'get_invitation_by_token',
    'get_numbering_counters',
    'prepare_hr_payroll_atomic',
    'record_stock_movements_atomic',
    'reserve_organization_invitation',
    'save_accounting_entry_atomic',
    'save_customer_credit_note_atomic',
    'save_customer_invoice_atomic',
    'save_default_treasury_account_atomic',
    'save_pro_commercial_document_atomic',
    'save_supplier_credit_note_atomic',
    'save_supplier_invoice_atomic',
    'set_default_treasury_account_atomic',
    'set_organization_logo',
    'transfer_stock_between_locations',
    'unallocate_customer_payment_atomic',
    'unapply_customer_credit_note_atomic',
    'unapply_supplier_credit_note_atomic',
    'update_customer_payment_atomic'
  ];
begin
  for fn in
    select p.oid, n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not (p.proname = any (keep_names))
      and not exists (
        select 1 from pg_policy pol
        where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ilike '%' || p.proname || '%'
           or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%' || p.proname || '%'
      )
      and not exists (
        select 1 from pg_views v
        where v.schemaname in ('public', 'app_private')
          and v.definition ilike '%' || p.proname || '%'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from authenticated, public',
      fn.schema_name, fn.function_name, fn.identity_args
    );
    raise notice 'authenticated execute revoked on %.%(%)', fn.schema_name, fn.function_name, fn.identity_args;
  end loop;
end $$;

-- 4. Explicit deny. The table already has no client grants; the policy
--    documents that checkout leases are server-only.
do $$
begin
  if to_regclass('public.billing_checkout_leases') is null then
    raise notice 'billing_checkout_leases is absent; skip the deny policy';
    return;
  end if;
  execute 'drop policy if exists billing_checkout_leases_no_client_access on public.billing_checkout_leases';
  execute $policy$
    create policy billing_checkout_leases_no_client_access
      on public.billing_checkout_leases
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false)
  $policy$;
end $$;

commit;
