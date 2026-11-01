-- Apply manually after 099. No existing account, balance or preference is rewritten.
-- Application account creation/editing with a preferred account requires this RPC.
begin;

do $$ begin
  if to_regprocedure('app_private.assert_essential_write_access(uuid)') is null
    or to_regprocedure('app_private.has_active_org_membership(uuid)') is null
    or to_regprocedure('app_private.is_read_only_org_member(uuid)') is null
    or to_regprocedure('app_private.is_operator_org_member(uuid)') is null then
    raise exception 'TREASURY_107_PREREQUISITES_REQUIRED';
  end if;
end $$;

create or replace function app_private.assert_treasury_account_write_access(p_organization_id uuid)
returns void language plpgsql security definer set search_path=public,app_private as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id)
    or app_private.is_read_only_org_member(p_organization_id)
    or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'TREASURY_ACCOUNT_WRITE_REQUIRED' using errcode='42501';
  end if;
  perform app_private.assert_essential_write_access(p_organization_id);
  -- All preferred-account switches through these RPCs share one tenant lock.
  perform pg_advisory_xact_lock(hashtextextended('treasury-default:'||p_organization_id::text,0));
end $$;
revoke all on function app_private.assert_treasury_account_write_access(uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.assert_treasury_account_write_access(uuid) to authenticated;

create or replace function public.set_default_treasury_account_atomic(p_organization_id uuid,p_account_id uuid)
returns uuid language plpgsql security invoker set search_path=public,app_private as $$
begin
  perform app_private.assert_treasury_account_write_access(p_organization_id);
  -- Check and lock the target before changing the existing preference.
  perform 1 from public.treasury_accounts where organization_id=p_organization_id and id=p_account_id for update;
  if not found then raise exception 'TREASURY_ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  update public.treasury_accounts set is_default=false
    where organization_id=p_organization_id and is_default and id<>p_account_id;
  update public.treasury_accounts set is_default=true,status='active',archived_at=null
    where organization_id=p_organization_id and id=p_account_id;
  if not found then raise exception 'TREASURY_ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  return p_account_id;
end $$;
revoke all on function public.set_default_treasury_account_atomic(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.set_default_treasury_account_atomic(uuid,uuid) to authenticated;

create or replace function public.save_default_treasury_account_atomic(p_organization_id uuid,p_account_id uuid,p_header jsonb)
returns uuid language plpgsql security invoker set search_path=public,app_private as $$
declare saved_id uuid; target_currency text;
begin
  perform app_private.assert_treasury_account_write_access(p_organization_id);
  if jsonb_typeof(p_header) is distinct from 'object' or nullif(btrim(p_header->>'name'),'') is null then
    raise exception 'TREASURY_ACCOUNT_INVALID';
  end if;
  if coalesce(p_header->>'currency','MAD')<>'MAD' then raise exception 'FINANCE_MAD_ONLY'; end if;
  if p_account_id is null then
    if coalesce(p_header->>'opening_balance','0') !~ '^[+-]?[0-9]+(\.[0-9]+)?$' then
      raise exception 'TREASURY_ACCOUNT_INVALID';
    end if;
    insert into public.treasury_accounts(
      organization_id,name,code,account_type,bank_name,agency_name,rib,iban,swift,account_number,currency,
      opening_balance,current_balance,opening_balance_date,is_default,status,notes,created_by
    ) values (
      p_organization_id,btrim(p_header->>'name'),nullif(p_header->>'code',''),coalesce(p_header->>'account_type','bank'),
      p_header->>'bank_name',p_header->>'agency_name',p_header->>'rib',p_header->>'iban',p_header->>'swift',p_header->>'account_number','MAD',
      coalesce((p_header->>'opening_balance')::numeric,0),coalesce((p_header->>'opening_balance')::numeric,0),
      nullif(p_header->>'opening_balance_date','')::date,false,'active',p_header->>'notes',auth.uid()
    ) returning id into saved_id;
  else
    select currency into target_currency from public.treasury_accounts where organization_id=p_organization_id and id=p_account_id for update;
    if not found then raise exception 'TREASURY_ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
    if target_currency is distinct from 'MAD' then raise exception 'FINANCE_MAD_ONLY'; end if;
    -- Balances and ownership cannot be overwritten through account metadata.
    update public.treasury_accounts set
      name=btrim(p_header->>'name'),code=nullif(p_header->>'code',''),account_type=coalesce(p_header->>'account_type','bank'),
      bank_name=p_header->>'bank_name',agency_name=p_header->>'agency_name',rib=p_header->>'rib',iban=p_header->>'iban',
      swift=p_header->>'swift',account_number=p_header->>'account_number',currency='MAD',
      opening_balance_date=nullif(p_header->>'opening_balance_date','')::date,notes=p_header->>'notes'
      where organization_id=p_organization_id and id=p_account_id;
    saved_id:=p_account_id;
  end if;
  perform public.set_default_treasury_account_atomic(p_organization_id,saved_id);
  return saved_id;
end $$;
revoke all on function public.save_default_treasury_account_atomic(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_default_treasury_account_atomic(uuid,uuid,jsonb) to authenticated;

select to_regprocedure('public.set_default_treasury_account_atomic(uuid,uuid)') is not null
  and to_regprocedure('public.save_default_treasury_account_atomic(uuid,uuid,jsonb)') is not null as treasury_107_actif;
commit;
