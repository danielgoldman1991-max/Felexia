-- MANUAL after104: tenant-scoped PRO reads, including private Storage.
-- No business DML, no existing policy/grant/function change. Expired PRO reads remain.
-- ESSENTIEL invoices, payments, journals, entries, bank accounts and products are untouched.
begin;

do $migration$
declare
  fn record; existing pg_proc%rowtype; fn_oid oid;
  target record; existing_policy pg_policy%rowtype; expected text; actual text;
  authenticated_oid oid := (select oid from pg_roles where rolname='authenticated');
  read_body constant text := $read$
  select coalesce(auth.uid() is not null
    and app_private.is_org_member(p_organization_id)
    and (select s.plan_code in ('premium','pro')
      from public.organization_subscriptions s
      where s.organization_id=p_organization_id
      order by s.created_at desc limit 1),false);
$read$;
  storage_body constant text := $storage$
declare org_text text;
begin
  if p_bucket not in ('organization-documents','hr-documents','tax-exports') then return true; end if;
  if p_name is null or p_name ~ '(^|/)[.]{1,2}(/|$)' then return false; end if;
  org_text := case when split_part(p_name,'/',1)='organizations'
    then split_part(p_name,'/',2) else split_part(p_name,'/',1) end;
  if org_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (case when split_part(p_name,'/',1)='organizations'
      then split_part(p_name,'/',3) else split_part(p_name,'/',2) end)='' then return false; end if;
  return app_private.can_read_pro_erp_110(org_text::uuid);
end;
$storage$;
begin
  if authenticated_oid is null
    or to_regprocedure('app_private.is_org_member(uuid)') is null
    or to_regprocedure('app_private.assert_pro_write_access(uuid,boolean)') is null
    or to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null
    or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception 'PRO110_PREREQUISITE_REQUIRED';
  end if;
  if exists(select 1 from storage.buckets where id in ('organization-documents','hr-documents','tax-exports') and public) then
    raise exception 'PRO110_PUBLIC_BUCKET_REQUIRES_REVIEW';
  end if;

  for fn in select * from (values
    ('app_private.can_read_pro_erp_110(uuid)','can_read_pro_erp_110','p_organization_id uuid','sql',read_body,array['p_organization_id']),
    ('app_private.can_read_pro_storage_110(text,text)','can_read_pro_storage_110','p_bucket text,p_name text','plpgsql',storage_body,array['p_bucket','p_name'])
  ) as functions(signature,name,args,language,body,argnames) loop
    fn_oid:=to_regprocedure(fn.signature);
    if fn_oid is null then
      execute format('create function app_private.%I(%s) returns boolean language %I stable security definer set search_path=pg_catalog,public,app_private as %L',fn.name,fn.args,fn.language,fn.body);
      execute 'revoke all on function '||fn.signature||' from public,anon,authenticated,service_role';
      execute 'grant execute on function '||fn.signature||' to authenticated';
      fn_oid:=to_regprocedure(fn.signature);
    end if;
    select * into strict existing from pg_proc where oid=fn_oid;
    if existing.prokind<>'f' or existing.prorettype<>'boolean'::regtype
      or not existing.prosecdef or existing.provolatile<>'s'
      or existing.proargnames is distinct from fn.argnames
      or existing.pronargdefaults<>0
      or (select lanname from pg_language where oid=existing.prolang)<>fn.language
      or btrim(replace(existing.prosrc,E'\r\n',E'\n'))<>btrim(replace(fn.body,E'\r\n',E'\n'))
      or cardinality(existing.proconfig) is distinct from 1
      or replace(existing.proconfig[1],' ','')<>'search_path=pg_catalog,public,app_private'
      or not has_function_privilege('authenticated',fn_oid,'EXECUTE')
      or has_function_privilege('anon',fn_oid,'EXECUTE')
      or has_function_privilege('service_role',fn_oid,'EXECUTE')
      or exists(select 1 from aclexplode(coalesce(existing.proacl,acldefault('f',existing.proowner))) acl
        where acl.privilege_type='EXECUTE' and acl.grantee not in (existing.proowner,authenticated_oid)) then
      raise exception 'PRO110_UNEXPECTED_HELPER: %',fn.signature;
    end if;
  end loop;

  for target in
    select c.oid,c.relname,c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='organization_id' and not a.attisdropped
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
    if not target.relrowsecurity then raise exception 'PRO110_RLS_DISABLED: %',target.relname; end if;
    expected:='app_private.can_read_pro_erp_110(organization_id)';
    if target.relname in ('stock_moves','stock_levels','warehouses') then
      -- Read-only exception within admitted automatic stock triggers, never a direct REST read.
      expected:='(app_private.can_read_pro_erp_110(organization_id) OR ((pg_trigger_depth() > 0) AND app_private.is_org_member(organization_id)))';
    end if;
    select * into existing_policy from pg_policy where polrelid=target.oid and polname='pro_read_guard_110';
    if not found then
      execute format('create policy pro_read_guard_110 on public.%I as restrictive for select to authenticated using(%s)',target.relname,expected);
      select * into strict existing_policy from pg_policy where polrelid=target.oid and polname='pro_read_guard_110';
    end if;
    actual:=pg_get_expr(existing_policy.polqual,target.oid);
    if existing_policy.polpermissive or existing_policy.polcmd<>'r'
      or existing_policy.polroles is distinct from array[authenticated_oid]
      or existing_policy.polwithcheck is not null
      or regexp_replace(actual,'[[:space:]]','','g')<>regexp_replace(expected,'[[:space:]]','','g') then
      raise exception 'PRO110_UNEXPECTED_POLICY: %',target.relname;
    end if;
  end loop;
  if not exists(select 1 from pg_policy where polrelid='public.sales_documents'::regclass and polname='pro_read_guard_110')
    or not exists(select 1 from pg_policy where polrelid='public.hr_departments'::regclass and polname='pro_read_guard_110') then
    raise exception 'PRO110_EXPECTED_TABLES_REQUIRED';
  end if;

  expected:='app_private.can_read_pro_storage_110(bucket_id, name)';
  select * into existing_policy from pg_policy where polrelid='storage.objects'::regclass and polname='pro_storage_read_guard_110';
  if not found then
    execute 'create policy pro_storage_read_guard_110 on storage.objects as restrictive for select to authenticated using('||expected||')';
    select * into strict existing_policy from pg_policy where polrelid='storage.objects'::regclass and polname='pro_storage_read_guard_110';
  end if;
  if existing_policy.polpermissive or existing_policy.polcmd<>'r'
    or existing_policy.polroles is distinct from array[authenticated_oid]
    or existing_policy.polwithcheck is not null
    or regexp_replace(pg_get_expr(existing_policy.polqual,'storage.objects'::regclass),'[[:space:]]','','g')<>regexp_replace(expected,'[[:space:]]','','g') then
    raise exception 'PRO110_UNEXPECTED_STORAGE_POLICY';
  end if;
end;
$migration$;

notify pgrst,'reload schema';
commit;

select exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='pro_storage_read_guard_110' and not polpermissive and polcmd='r')
  and exists(select 1 from pg_policy where polrelid='public.sales_documents'::regclass and polname='pro_read_guard_110' and not polpermissive and polcmd='r')
  and exists(select 1 from pg_policy where polrelid='public.hr_departments'::regclass and polname='pro_read_guard_110' and not polpermissive and polcmd='r')
  as pro_read_110_actif;
