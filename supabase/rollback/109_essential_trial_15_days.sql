-- MANUAL rollback of109 only: future new trials return to one calendar month.
-- Existing trials/subscriptions/dates/prices/ACL are unchanged. No DML.
begin;

do $migration$
declare
  fn_oid oid := to_regprocedure('public.ensure_essential_trial(uuid)');
  before_proc pg_proc%rowtype; after_proc pg_proc%rowtype;
  before_body text; canonical_body text; patched_body text; definition text;
  old_fragment constant text := 'ended := started + interval ''1 month'';';
  new_fragment constant text := 'ended := started + interval ''360 hours'';';
  price_prefix constant text := 'started,started,ended,ended,started,ended,true,started,false,';
  price_pattern constant text := 'started,started,ended,ended,started,ended,true,started,false,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*,[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*[)];';
  old_count integer; new_count integer; price_count integer;
begin
  if fn_oid is null then raise exception 'TRIAL109_PREREQUISITE_REQUIRED'; end if;
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
    raise exception 'TRIAL109_UNEXPECTED_SECURITY';
  end if;
  before_body:=btrim(replace(before_proc.prosrc,E'\r\n',E'\n'),E' \t\r\n');
  old_count:=(length(before_body)-length(replace(before_body,old_fragment,'')))/length(old_fragment);
  new_count:=(length(before_body)-length(replace(before_body,new_fragment,'')))/length(new_fragment);
  if old_count+new_count<>1 then raise exception 'TRIAL109_UNEXPECTED_DATE_FRAGMENT'; end if;
  select count(*) into price_count from regexp_matches(before_body,price_pattern,'g');
  if price_count<>1 then raise exception 'TRIAL109_UNEXPECTED_AMOUNT_SHAPE'; end if;
  canonical_body:=replace(before_body,new_fragment,old_fragment);
  canonical_body:=regexp_replace(canonical_body,price_pattern,price_prefix||'__MONTHLY__,__YEARLY__);','g');
  if md5(canonical_body)<>'e906b328174abdaffef27b00d0d564a1' then
    raise exception 'TRIAL109_UNEXPECTED_DEFINITION';
  end if;
  patched_body:=replace(before_proc.prosrc,new_fragment,old_fragment);
  if before_proc.prosrc is distinct from patched_body then
    definition:=replace(pg_get_functiondef(fn_oid),new_fragment,old_fragment);
    execute definition;
  end if;
  select * into strict after_proc from pg_proc where oid=fn_oid;
  if (to_jsonb(before_proc)-'prosrc') is distinct from (to_jsonb(after_proc)-'prosrc')
    or after_proc.prosrc is distinct from patched_body then
    raise exception 'TRIAL109_POSTCHECK_FAILED';
  end if;
end;
$migration$;

notify pgrst,'reload schema';
commit;

select coalesce((select strpos(prosrc,'ended := started + interval ''1 month'';')>0
  and strpos(prosrc,'ended := started + interval ''360 hours'';')=0
  from pg_proc where oid=to_regprocedure('public.ensure_essential_trial(uuid)')),false)
  as essential_trial_109_rollback_actif;
