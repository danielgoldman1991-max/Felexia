-- Manual launch correction: exact110 then exact111. No business row updates.
-- Both migrations are independently transactional. Retain tenant isolation if111 needs review.
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

-- MANUAL installation after109. Future ESSENTIEL trials only:99/1188MAD.
-- Changes two known numeric literals, never a contract or catalogue row.
begin;

do $migration$
declare
  fn_oid oid := to_regprocedure('public.ensure_essential_trial(uuid)');
  before_proc pg_proc%rowtype; after_proc pg_proc%rowtype;
  before_body text; canonical_body text; patched_body text; definition text;
  date_fragment constant text := 'ended := started + interval ''360 hours'';';
  old_date constant text := 'ended := started + interval ''1 month'';';
  price_prefix constant text := 'started,started,ended,ended,started,ended,true,started,false,';
  price_pattern constant text := 'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*[)];';
  price_fragment text; price_values text[]; patched_fragment text;
  price_count integer; date_count integer;
begin
  if fn_oid is null then raise exception 'TRIAL111_PREREQUISITE_REQUIRED'; end if;
  select * into strict before_proc from pg_proc where oid=fn_oid;
  if before_proc.prokind<>'f' or not before_proc.prosecdef
    or before_proc.prorettype<>'boolean'::regtype
    or before_proc.pronargs<>1 or before_proc.proargtypes[0]<>'uuid'::regtype
    or before_proc.proargnames is distinct from array['p_organization_id']::text[]
    or before_proc.pronargdefaults<>0
    or (select lanname from pg_language where oid=before_proc.prolang)<>'plpgsql'
    or not exists(select 1 from unnest(before_proc.proconfig) setting
      where replace(setting,' ','') in ('search_path=public,app_private','search_path=pg_catalog,public,app_private'))
    or not has_function_privilege('authenticated',fn_oid,'EXECUTE')
    or has_function_privilege('anon',fn_oid,'EXECUTE')
    or exists(select 1 from aclexplode(coalesce(before_proc.proacl,acldefault('f',before_proc.proowner))) acl
      where acl.grantee=0 and acl.privilege_type='EXECUTE') then
    raise exception 'TRIAL111_UNEXPECTED_SECURITY';
  end if;
  before_body:=btrim(replace(before_proc.prosrc,E'\r\n',E'\n'),E' \t\r\n');
  date_count:=(length(before_body)-length(replace(before_body,date_fragment,'')))/length(date_fragment);
  if date_count<>1 or strpos(before_body,old_date)>0 then raise exception 'TRIAL111_REQUIRE_109'; end if;
  select count(*) into price_count from regexp_matches(before_body,price_pattern,'g');
  if price_count<>1 then raise exception 'TRIAL111_UNEXPECTED_AMOUNT_SHAPE'; end if;
  canonical_body:=replace(before_body,date_fragment,old_date);
  canonical_body:=regexp_replace(canonical_body,price_pattern,price_prefix||'__MONTHLY__,__YEARLY__);','g');
  if md5(canonical_body)<>'e906b328174abdaffef27b00d0d564a1' then raise exception 'TRIAL111_UNEXPECTED_DEFINITION'; end if;
  select m[1] into strict price_fragment from regexp_matches(before_proc.prosrc,'('||price_pattern||')','g') m;
  price_values:=regexp_match(price_fragment,price_prefix||'[[:space:]]*([0-9]+([.][0-9]+)?)[[:space:]]*,[[:space:]]*([0-9]+([.][0-9]+)?)[[:space:]]*[)];');
  if not ((price_values[1]='290' and price_values[3]='2900')
    or (price_values[1]='99' and price_values[3]='1188')) then
    raise exception 'TRIAL111_UNEXPECTED_AMOUNTS';
  end if;
  patched_body:=before_proc.prosrc;
  if price_values[1]='290' then
    patched_fragment:=regexp_replace(price_fragment,
      '('||price_prefix||'[[:space:]]*)[0-9]+([.][0-9]+)?([[:space:]]*,[[:space:]]*)[0-9]+([.][0-9]+)?([[:space:]]*[)];)',
      E'\\1'||'99'||E'\\3'||'1188'||E'\\5');
    patched_body:=replace(before_proc.prosrc,price_fragment,patched_fragment);
    definition:=replace(pg_get_functiondef(fn_oid),price_fragment,patched_fragment);
    execute definition;
  end if;
  select * into strict after_proc from pg_proc where oid=fn_oid;
  if (to_jsonb(before_proc)-'prosrc') is distinct from (to_jsonb(after_proc)-'prosrc')
    or after_proc.prosrc is distinct from patched_body
    or strpos(after_proc.prosrc,date_fragment)=0 then
    raise exception 'TRIAL111_POSTCHECK_FAILED';
  end if;
end;
$migration$;

notify pgrst,'reload schema';
commit;

with installed as (
  select p.*,btrim(replace(p.prosrc,E'\r\n',E'\n'),E' \t\r\n') body
  from pg_proc p where p.oid=to_regprocedure('public.ensure_essential_trial(uuid)')
), checked as (
  select prosecdef and prorettype='boolean'::regtype
    and has_function_privilege('authenticated',oid,'EXECUTE')
    and not has_function_privilege('anon',oid,'EXECUTE')
    and strpos(body,'ended := started + interval ''360 hours'';')>0
    and strpos(body,'ended := started + interval ''1 month'';')=0
    and body ~ 'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*99[[:space:]]*,[[:space:]]*1188[[:space:]]*[)];'
    and md5(regexp_replace(
      replace(body,'ended := started + interval ''360 hours'';','ended := started + interval ''1 month'';'),
      'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*[)];',
      'started,started,ended,ended,started,ended,true,started,false,__MONTHLY__,__YEARLY__);','g'))='e906b328174abdaffef27b00d0d564a1' ok
  from installed
)
select coalesce((select ok from checked),false) as essential_trial_111_actif,
  case when coalesce((select ok from checked),false) then 99 end as monthly_mad,
  case when coalesce((select ok from checked),false) then 1188 end as yearly_mad,
  case when coalesce((select ok from checked),false) then 15 end as days;

-- Combined final indicators
with installed as (
  select p.*,btrim(replace(p.prosrc,E'\r\n',E'\n'),E' \t\r\n') body
  from pg_proc p where p.oid=to_regprocedure('public.ensure_essential_trial(uuid)')
), checked as (
  select prosecdef and prorettype='boolean'::regtype
    and has_function_privilege('authenticated',oid,'EXECUTE')
    and not has_function_privilege('anon',oid,'EXECUTE')
    and strpos(body,'ended := started + interval ''360 hours'';')>0
    and strpos(body,'ended := started + interval ''1 month'';')=0
    and body ~ 'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*99[[:space:]]*,[[:space:]]*1188[[:space:]]*[)];'
    and md5(regexp_replace(
      replace(body,'ended := started + interval ''360 hours'';','ended := started + interval ''1 month'';'),
      'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*[)];',
      'started,started,ended,ended,started,ended,true,started,false,__MONTHLY__,__YEARLY__);','g'))='e906b328174abdaffef27b00d0d564a1' ok
  from installed
)
select exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='pro_storage_read_guard_110' and not polpermissive and polcmd='r')
  and exists(select 1 from pg_policy where polrelid='public.sales_documents'::regclass and polname='pro_read_guard_110' and not polpermissive and polcmd='r')
  and exists(select 1 from pg_policy where polrelid='public.hr_departments'::regclass and polname='pro_read_guard_110' and not polpermissive and polcmd='r') as pro_read_110_actif,
  coalesce((select ok from checked),false) as essential_trial_111_actif,
  case when coalesce((select ok from checked),false) then 99 end as monthly_mad,
  case when coalesce((select ok from checked),false) then 1188 end as yearly_mad,
  case when coalesce((select ok from checked),false) then 15 end as days;
