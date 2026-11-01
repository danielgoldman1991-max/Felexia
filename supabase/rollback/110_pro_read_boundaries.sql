-- MANUAL rollback of110 only. No business rows or existing grants/policies change.
-- Restores the previous read policies, including their broad Storage access.
-- Prefer correcting a scoped compatibility issue rather than reverting tenant isolation.
begin;

do $rollback$
declare
  fn record; existing pg_proc%rowtype; target record; policy pg_policy%rowtype;
  expected text; authenticated_oid oid := (select oid from pg_roles where rolname='authenticated');
begin
  for fn in select * from (values
    ('app_private.can_read_pro_storage_110(text,text)','2958c32900e4e14b60ffaac5b4553f77','plpgsql',array['p_bucket','p_name']),
    ('app_private.can_read_pro_erp_110(uuid)','fc743b27956a5a49c169999b2d2382dd','sql',array['p_organization_id'])
  ) as helpers(signature,body_md5,language,argnames) loop
    select * into existing from pg_proc where oid=to_regprocedure(fn.signature);
    if found and (existing.prokind<>'f' or existing.prorettype<>'boolean'::regtype
      or not existing.prosecdef or existing.provolatile<>'s' or existing.pronargdefaults<>0
      or existing.proargnames is distinct from fn.argnames
      or (select lanname from pg_language where oid=existing.prolang)<>fn.language
      or md5(btrim(replace(existing.prosrc,E'\r\n',E'\n'),E' \t\r\n'))<>fn.body_md5
      or cardinality(existing.proconfig) is distinct from 1
      or replace(existing.proconfig[1],' ','')<>'search_path=pg_catalog,public,app_private'
      or not has_function_privilege('authenticated',existing.oid,'EXECUTE')
      or has_function_privilege('anon',existing.oid,'EXECUTE')
      or has_function_privilege('service_role',existing.oid,'EXECUTE')
      or exists(select 1 from aclexplode(coalesce(existing.proacl,acldefault('f',existing.proowner))) acl
        where acl.privilege_type='EXECUTE' and acl.grantee not in (existing.proowner,authenticated_oid))) then
      raise exception 'PRO110_ROLLBACK_UNEXPECTED_HELPER: %',fn.signature;
    end if;
  end loop;

  for target in
    select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and (
      c.relname like 'hr\_%' escape '\' or c.relname=any(array[
        'stock_moves','stock_levels','warehouses','inventory_adjustments','inventory_adjustment_lines',
        'sales_documents','sales_document_lines','sales_quotes','sales_quote_lines','sales_orders','sales_order_lines','delivery_notes','delivery_note_lines',
        'purchase_documents','purchase_document_lines','purchase_orders','purchase_order_lines','goods_receipts','goods_receipt_lines',
        'documents','bank_statement_imports','bank_statement_lines','bank_reconciliations',
        'treasury_forecast_items','cashflow_forecasts','vat_declarations','tax_export_batches'
      ])
    )
  loop
    select * into policy from pg_policy where polrelid=target.oid and polname='pro_read_guard_110';
    if not found then continue; end if;
    expected:='app_private.can_read_pro_erp_110(organization_id)';
    if target.relname in ('stock_moves','stock_levels','warehouses') then
      expected:='(app_private.can_read_pro_erp_110(organization_id) OR ((pg_trigger_depth() > 0) AND app_private.is_org_member(organization_id)))';
    end if;
    if policy.polpermissive or policy.polcmd<>'r' or policy.polroles is distinct from array[authenticated_oid]
      or policy.polwithcheck is not null
      or regexp_replace(pg_get_expr(policy.polqual,target.oid),'[[:space:]]','','g')<>regexp_replace(expected,'[[:space:]]','','g') then
      raise exception 'PRO110_ROLLBACK_UNEXPECTED_POLICY: %',target.relname;
    end if;
    execute format('drop policy pro_read_guard_110 on public.%I',target.relname);
  end loop;
  select * into policy from pg_policy where polrelid='storage.objects'::regclass and polname='pro_storage_read_guard_110';
  if found then
    if policy.polpermissive or policy.polcmd<>'r' or policy.polroles is distinct from array[authenticated_oid]
      or policy.polwithcheck is not null
      or regexp_replace(pg_get_expr(policy.polqual,'storage.objects'::regclass),'[[:space:]]','','g')<>'app_private.can_read_pro_storage_110(bucket_id,name)' then
      raise exception 'PRO110_ROLLBACK_UNEXPECTED_STORAGE_POLICY';
    end if;
    drop policy pro_storage_read_guard_110 on storage.objects;
  end if;
  -- RESTRICT is intentional: unknown dependent objects make rollback fail atomically.
  drop function if exists app_private.can_read_pro_storage_110(text,text) restrict;
  drop function if exists app_private.can_read_pro_erp_110(uuid) restrict;
end;
$rollback$;

notify pgrst,'reload schema';
commit;

select to_regprocedure('app_private.can_read_pro_erp_110(uuid)') is null
  and to_regprocedure('app_private.can_read_pro_storage_110(text,text)') is null
  and not exists(select 1 from pg_policy where polname in ('pro_read_guard_110','pro_storage_read_guard_110'))
  as pro_read_110_rollback_actif;
