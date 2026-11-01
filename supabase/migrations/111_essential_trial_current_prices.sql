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
