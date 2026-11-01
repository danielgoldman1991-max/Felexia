-- Business conflicts are HTTP409, not PostgreSQL serialization failures.
-- Manual installation after105–107. No business row or existing ACL is changed.
-- Exact body fingerprints tolerate CRLF/LF only; unexpected definitions refuse.
begin;

do $migration$
declare
  target record; fragment jsonb; fn_oid oid;
  before_proc pg_proc%rowtype; after_proc pg_proc%rowtype;
  before_body text; canonical_body text; patched_body text; definition text;
  old_fragment text; new_fragment text; old_count integer; new_count integer;
begin
  for target in select * from (values
    ('public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamp with time zone,jsonb,jsonb)',
      '48729f7b4aa79799de453d431241f00c', '5c86b4d0f91ade6cb718c747a9bfcd13',
      array['p_organization_id','p_document_id','p_kind','p_expected_updated_at','p_header','p_lines'],
      '["PRO_DOCUMENT_CHANGED","PRO_TAX_RATE_CHANGED"]'::jsonb),
    ('public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)',
      '6987d15983bce76cdb08a87ca6fe2efa', '71c6ca50010dbbd8c183f2f125d7571b',
      array['p_organization_id','p_period_id','p_expected_updated_at','p_ack_base_only'],
      '["PAYROLL_PERIOD_CHANGED"]'::jsonb)
  ) as targets(signature,canonical_md5,patched_md5,argument_names,messages) loop
    fn_oid:=to_regprocedure(target.signature);
    if fn_oid is null then raise exception 'PRO108_PREREQUISITE_REQUIRED: %',target.signature; end if;
    select * into strict before_proc from pg_proc where oid=fn_oid;
    if not before_proc.prosecdef or before_proc.prokind<>'f'
      or (select lanname from pg_language where oid=before_proc.prolang)<>'plpgsql'
      or before_proc.proargnames is distinct from target.argument_names
      or cardinality(before_proc.proconfig) is distinct from 1
      or replace(before_proc.proconfig[1],' ','') is distinct from 'search_path=pg_catalog,public,app_private'
      or not has_function_privilege('authenticated',fn_oid,'EXECUTE')
      or has_function_privilege('anon',fn_oid,'EXECUTE')
      or has_function_privilege('service_role',fn_oid,'EXECUTE')
      or exists(select 1 from aclexplode(coalesce(before_proc.proacl,acldefault('f',before_proc.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE') then
      raise exception 'PRO108_UNEXPECTED_SECURITY: %',target.signature;
    end if;
    before_body:=btrim(replace(before_proc.prosrc,E'\r\n',E'\n'),E' \t\r\n');
    canonical_body:=before_body; patched_body:=before_body;
    definition:=pg_get_functiondef(fn_oid);
    for fragment in select value from jsonb_array_elements(target.messages) loop
      old_fragment:='raise exception '||quote_literal(fragment #>> '{}')||' using errcode=''40001'';';
      new_fragment:='raise exception '||quote_literal(fragment #>> '{}')||' using errcode=''PT409'';';
      old_count:=(length(before_body)-length(replace(before_body,old_fragment,'')))/length(old_fragment);
      new_count:=(length(before_body)-length(replace(before_body,new_fragment,'')))/length(new_fragment);
      if old_count+new_count<>1 then raise exception 'PRO108_UNEXPECTED_FRAGMENT: % / %',target.signature,fragment; end if;
      canonical_body:=replace(canonical_body,new_fragment,old_fragment);
      patched_body:=replace(patched_body,old_fragment,new_fragment);
      definition:=replace(definition,old_fragment,new_fragment);
    end loop;
    if md5(canonical_body)<>target.canonical_md5 or md5(patched_body)<>target.patched_md5 then
      raise exception 'PRO108_UNEXPECTED_DEFINITION: %',target.signature;
    end if;
    if before_body is distinct from patched_body then execute definition; end if;
    select * into strict after_proc from pg_proc where oid=fn_oid;
    if (to_jsonb(before_proc)-'prosrc') is distinct from (to_jsonb(after_proc)-'prosrc')
      or md5(btrim(replace(after_proc.prosrc,E'\r\n',E'\n'),E' \t\r\n'))<>target.patched_md5 then
      raise exception 'PRO108_POSTCHECK_FAILED: %',target.signature;
    end if;
  end loop;
end;
$migration$;

notify pgrst,'reload schema';
commit;

select coalesce((select md5(btrim(replace(prosrc,E'\r\n',E'\n'),E' \t\r\n'))='5c86b4d0f91ade6cb718c747a9bfcd13' and prosecdef
  from pg_proc where oid=to_regprocedure('public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamp with time zone,jsonb,jsonb)')),false)
  and coalesce((select md5(btrim(replace(prosrc,E'\r\n',E'\n'),E' \t\r\n'))='71c6ca50010dbbd8c183f2f125d7571b' and prosecdef
  from pg_proc where oid=to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)')),false) as pro_108_actif;
