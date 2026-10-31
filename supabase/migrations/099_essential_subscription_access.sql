-- Felexia Pro: server-owned billing, one-time trial, write entitlements and
-- concurrency-safe monthly commercial-document usage. Apply after 098.
-- Existing plans, dates, documents and commercial amounts are not rewritten.
begin;

alter table public.organization_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_consent_accepted boolean not null default false,
  add column if not exists trial_consent_accepted_at timestamptz;

-- Restrictive guards also close older permissive "member" policies.
drop policy if exists essential_billing_insert_server_only on public.organization_subscriptions;
create policy essential_billing_insert_server_only on public.organization_subscriptions
  as restrictive for insert to anon,authenticated with check (false);
drop policy if exists essential_billing_update_server_only on public.organization_subscriptions;
create policy essential_billing_update_server_only on public.organization_subscriptions
  as restrictive for update to anon,authenticated using (false) with check (false);
drop policy if exists essential_billing_delete_server_only on public.organization_subscriptions;
create policy essential_billing_delete_server_only on public.organization_subscriptions
  as restrictive for delete to anon,authenticated using (false);

create or replace function app_private.guard_billing_customer_reference()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin
  if (auth.uid() is not null or coalesce(current_setting('role',true),'none') in ('anon','authenticated'))
    and ((TG_OP='INSERT' and new.stripe_customer_id is not null) or
      (TG_OP='UPDATE' and new.stripe_customer_id is distinct from old.stripe_customer_id)) then
    raise exception 'BILLING_SERVER_REQUIRED' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_billing_customer_reference() from public,anon,authenticated;
drop trigger if exists aa_billing_customer_reference on public.organizations;
create trigger aa_billing_customer_reference before insert or update on public.organizations
  for each row execute function app_private.guard_billing_customer_reference();

create or replace function public.ensure_essential_trial(p_organization_id uuid)
returns boolean language plpgsql security definer set search_path=public,app_private as $$
declare plan_uuid uuid; started timestamptz := clock_timestamp(); ended timestamptz;
begin
  if auth.uid() is null or not app_private.is_org_admin(p_organization_id) then
    raise exception 'BILLING_ADMIN_REQUIRED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('essential-trial|'||p_organization_id::text,0));
  if exists(select 1 from organization_subscriptions where organization_id=p_organization_id) then return false; end if;
  select id into plan_uuid from subscription_plans where code='essentiel';
  if plan_uuid is null then raise exception 'ESSENTIEL_PLAN_UNAVAILABLE'; end if;
  -- PostgreSQL clamps month ends (31 October -> 30 November).
  ended := started + interval '1 month';
  insert into organization_subscriptions(organization_id,plan_id,plan_code,status,billing_cycle,billing_interval,
    trial_started_at,trial_start,trial_end,trial_ends_at,current_period_start,current_period_end,
    trial_consent_accepted,trial_consent_accepted_at,cancel_at_period_end,monthly_amount,yearly_amount)
  values(p_organization_id,plan_uuid,'essentiel','trialing','monthly','monthly',
    started,started,ended,ended,started,ended,true,started,false,290,2900);
  return true;
end $$;
revoke all on function public.ensure_essential_trial(uuid) from public,anon;
grant execute on function public.ensure_essential_trial(uuid) to authenticated;

create or replace function app_private.assert_essential_write_access(p_organization_id uuid)
returns void language plpgsql volatile security definer set search_path=public,app_private as $$
declare sub record;
begin
  if auth.uid() is null then
    if coalesce(current_setting('role',true),'none') in ('anon','authenticated') then
      raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode='42501';
    end if;
    return; -- trusted maintenance/service imports retain their normal table permissions
  end if;
  if not app_private.is_org_member(p_organization_id) then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  select status,coalesce(trial_ends_at,trial_end) as trial_end,current_period_end into sub
  from organization_subscriptions where organization_id=p_organization_id order by created_at desc limit 1 for share;
  if not found or not coalesce((
    (sub.status in ('trialing','trial') and sub.trial_end > clock_timestamp()) or
    (sub.status='active' and sub.current_period_end > clock_timestamp())
  ),false) then
    raise exception 'SUBSCRIPTION_WRITE_REQUIRED' using errcode='42501';
  end if;
end $$;
revoke all on function app_private.assert_essential_write_access(uuid) from public,anon;
grant execute on function app_private.assert_essential_write_access(uuid) to authenticated;

create or replace function app_private.guard_essential_business_write()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin
  perform app_private.assert_essential_write_access(case when TG_OP='DELETE' then old.organization_id else new.organization_id end);
  if TG_OP='UPDATE' and old.organization_id is distinct from new.organization_id then
    raise exception 'ORGANIZATION_IMMUTABLE' using errcode='42501';
  end if;
  if TG_OP='UPDATE' and (to_jsonb(old)->>'id') is distinct from (to_jsonb(new)->>'id') then
    raise exception 'IMMUTABLE_RECORD_KEY' using errcode='42501';
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.guard_essential_business_write() from public,anon,authenticated;
do $$ declare tab text; begin
  foreach tab in array array['third_parties','third_party_contacts','third_party_addresses','products',
    'customer_invoices','customer_invoice_lines','supplier_invoices','supplier_invoice_lines',
    'customer_credit_notes','customer_credit_note_lines','customer_credit_note_applications',
    'customer_payments','customer_payment_allocations','supplier_payments','supplier_payment_allocations',
    'treasury_accounts','treasury_transactions','accounting_entries','accounting_entry_lines','sales_documents','sales_document_lines','purchase_documents','purchase_document_lines'] loop
    if to_regclass('public.'||tab) is not null then
      execute format('drop trigger if exists aa_essential_subscription_guard on public.%I',tab);
      execute format('create trigger aa_essential_subscription_guard before insert or update or delete on public.%I for each row execute function app_private.guard_essential_business_write()',tab);
    end if;
  end loop;
end $$;

create table if not exists public.commercial_document_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_table text not null, document_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(organization_id,document_table,document_id)
);
create index if not exists commercial_usage_month_idx on public.commercial_document_usage(organization_id,created_at);
alter table public.commercial_document_usage enable row level security;
drop policy if exists commercial_usage_member_read on public.commercial_document_usage;
create policy commercial_usage_member_read on public.commercial_document_usage for select to authenticated using(app_private.is_org_member(organization_id));
revoke all on public.commercial_document_usage from public,anon,authenticated;
grant select on public.commercial_document_usage to authenticated;

create or replace function public.get_commercial_document_usage(p_organization_id uuid)
returns bigint language plpgsql stable security definer set search_path=public,app_private as $$
declare month_start timestamptz := date_trunc('month',now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca'; total bigint;
begin
  if auth.uid() is null or not app_private.is_org_member(p_organization_id) then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  select count(*) into total from commercial_document_usage where organization_id=p_organization_id and created_at>=month_start
    and created_at < ((date_trunc('month',now() at time zone 'Africa/Casablanca')+interval '1 month') at time zone 'Africa/Casablanca');
  return total;
end $$;
revoke all on function public.get_commercial_document_usage(uuid) from public,anon;
grant execute on function public.get_commercial_document_usage(uuid) to authenticated;

create or replace function app_private.guard_commercial_document_quota()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare plan text; max_docs integer; used bigint; month_start timestamptz;
begin
  -- Each admitted document consumes a slot until month-end, even if later deleted.
  perform pg_advisory_xact_lock(hashtextextended('commercial-quota|'||new.organization_id::text,0));
  if exists(select 1 from commercial_document_usage where organization_id=new.organization_id and document_table=TG_TABLE_NAME and document_id=new.id) then return new; end if;
  if auth.uid() is not null then
    perform app_private.assert_essential_write_access(new.organization_id);
    select plan_code into plan from organization_subscriptions where organization_id=new.organization_id order by created_at desc limit 1;
    max_docs := case plan when 'premium' then null when 'business' then 3000 else 500 end;
    month_start := date_trunc('month',clock_timestamp() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca';
    select count(*) into used from commercial_document_usage where organization_id=new.organization_id and created_at>=month_start
      and created_at<((date_trunc('month',clock_timestamp() at time zone 'Africa/Casablanca')+interval '1 month') at time zone 'Africa/Casablanca');
    if max_docs is not null and used>=max_docs then
      raise exception 'COMMERCIAL_DOCUMENT_LIMIT_REACHED' using errcode='23514';
    end if;
  elsif coalesce(current_setting('role',true),'none') in ('anon','authenticated') then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  insert into commercial_document_usage(organization_id,document_table,document_id)
  values(new.organization_id,TG_TABLE_NAME,new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function app_private.guard_commercial_document_quota() from public,anon,authenticated;
do $$ declare tab text; begin
  foreach tab in array array['customer_invoices','supplier_invoices','customer_credit_notes','sales_documents','purchase_documents'] loop
    if to_regclass('public.'||tab) is not null then
      execute format('insert into public.commercial_document_usage(organization_id,document_table,document_id,created_at) select organization_id,%L,id,coalesce(created_at,now()) from public.%I on conflict do nothing',tab,tab);
      execute format('drop trigger if exists ab_commercial_document_quota on public.%I',tab);
      execute format('create trigger ab_commercial_document_quota before insert on public.%I for each row execute function app_private.guard_commercial_document_quota()',tab);
    end if;
  end loop;
end $$;

-- Short server-only checkout lease prevents simultaneous sessions for one company.
create table if not exists public.billing_checkout_leases(
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  lease_token uuid not null, expires_at timestamptz not null
);
alter table public.billing_checkout_leases enable row level security;
revoke all on public.billing_checkout_leases from public,anon,authenticated;
create or replace function public.claim_billing_checkout(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid(); claimed uuid;
begin
  insert into billing_checkout_leases(organization_id,lease_token,expires_at) values(p_organization_id,token,clock_timestamp()+interval '2 minutes')
  on conflict(organization_id) do update set lease_token=excluded.lease_token,expires_at=excluded.expires_at
  where billing_checkout_leases.expires_at<clock_timestamp() returning lease_token into claimed;
  return claimed;
end $$;
create or replace function public.release_billing_checkout(p_organization_id uuid,p_lease_token uuid)
returns void language sql security definer set search_path=public as $$
  delete from billing_checkout_leases where organization_id=p_organization_id and lease_token=p_lease_token;
$$;
revoke all on function public.claim_billing_checkout(uuid),public.release_billing_checkout(uuid,uuid) from public,anon,authenticated;

-- A claim is durable; a failed delivery can retry, a completed one is idempotent.
alter table public.stripe_events add column if not exists processing_started_at timestamptz;
alter table public.organization_subscriptions add column if not exists stripe_last_event_created bigint not null default 0;
create or replace function public.apply_stripe_subscription(p_organization_id uuid,p_payload jsonb,p_event_created bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare existing record; plan_uuid uuid; incoming_id text := p_payload->>'stripe_subscription_id'; incoming_status text := p_payload->>'status';
begin
  if incoming_id is null or incoming_status not in ('active','trialing','past_due','canceled','unpaid','incomplete') then raise exception 'STRIPE_INVALID_SUBSCRIPTION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-subscription|'||p_organization_id::text,0));
  select * into existing from organization_subscriptions where organization_id=p_organization_id for update;
  if found then
    if existing.stripe_last_event_created>p_event_created then return false; end if;
    -- Starting a failed/incomplete checkout must not consume an otherwise valid
    -- free trial. The first successful paid subscription replaces it normally.
    if existing.stripe_subscription_id is null and existing.status='trialing'
      and coalesce(existing.trial_ends_at,existing.trial_end)>clock_timestamp()
      and incoming_status not in ('active','trialing') then return false; end if;
    -- A delayed cancellation/update for an old subscription cannot replace a
    -- currently billed subscription from a different checkout.
    if existing.stripe_subscription_id is not null and existing.stripe_subscription_id<>incoming_id
      and (incoming_status='canceled' or existing.status in ('active','trialing','past_due','unpaid','incomplete')) then return false; end if;
  end if;
  select id into plan_uuid from subscription_plans where code=p_payload->>'plan_code';
  if plan_uuid is null then raise exception 'STRIPE_PLAN_UNAVAILABLE'; end if;
  insert into organization_subscriptions(organization_id,plan_id,plan_code,status,billing_cycle,billing_interval,
    stripe_subscription_id,stripe_customer_id,current_period_start,current_period_end,trial_start,trial_end,trial_ends_at,
    cancel_at_period_end,canceled_at,stripe_last_event_created,updated_at)
  values(p_organization_id,plan_uuid,p_payload->>'plan_code',incoming_status,p_payload->>'billing_cycle',p_payload->>'billing_cycle',
    incoming_id,p_payload->>'stripe_customer_id',(p_payload->>'current_period_start')::timestamptz,(p_payload->>'current_period_end')::timestamptz,
    (p_payload->>'trial_start')::timestamptz,(p_payload->>'trial_end')::timestamptz,(p_payload->>'trial_end')::timestamptz,
    coalesce((p_payload->>'cancel_at_period_end')::boolean,false),(p_payload->>'canceled_at')::timestamptz,p_event_created,clock_timestamp())
  on conflict(organization_id) do update set plan_id=excluded.plan_id,plan_code=excluded.plan_code,status=excluded.status,
    billing_cycle=excluded.billing_cycle,billing_interval=excluded.billing_interval,stripe_subscription_id=excluded.stripe_subscription_id,
    stripe_customer_id=excluded.stripe_customer_id,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
    trial_start=excluded.trial_start,trial_end=excluded.trial_end,trial_ends_at=excluded.trial_ends_at,cancel_at_period_end=excluded.cancel_at_period_end,
    canceled_at=excluded.canceled_at,stripe_last_event_created=excluded.stripe_last_event_created,updated_at=excluded.updated_at;
  update organizations set stripe_customer_id=p_payload->>'stripe_customer_id',updated_at=clock_timestamp() where id=p_organization_id;
  if not found then raise exception 'STRIPE_COMPANY_UNAVAILABLE'; end if;
  return true;
end $$;
revoke all on function public.apply_stripe_subscription(uuid,jsonb,bigint) from public,anon,authenticated;
create or replace function public.claim_stripe_event(p_event_id text,p_type text,p_data jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare existing record;
begin
  perform pg_advisory_xact_lock(hashtextextended('stripe-event|'||p_event_id,0));
  select processed,processing_started_at into existing from stripe_events where stripe_event_id=p_event_id for update;
  if found then
    if existing.processed then return 'processed'; end if;
    if existing.processing_started_at>clock_timestamp()-interval '5 minutes' then return 'processing'; end if;
    update stripe_events set processing_started_at=clock_timestamp(),error=null where stripe_event_id=p_event_id;
  else
    insert into stripe_events(stripe_event_id,type,data,processed,processing_started_at) values(p_event_id,p_type,p_data,false,clock_timestamp());
  end if;
  return 'claimed';
end $$;
revoke all on function public.claim_stripe_event(text,text,jsonb) from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.claim_billing_checkout(uuid),public.release_billing_checkout(uuid,uuid),public.claim_stripe_event(text,text,jsonb),public.apply_stripe_subscription(uuid,jsonb,bigint) to service_role;
    grant all on public.billing_checkout_leases,public.stripe_events,public.commercial_document_usage to service_role;
  end if;
end $$;

commit;

select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ensure_essential_trial')
  and exists(select 1 from pg_trigger where tgname='aa_essential_subscription_guard' and tgrelid='public.customer_invoices'::regclass)
  and exists(select 1 from pg_policy where polname='essential_billing_update_server_only')
  and exists(select 1 from pg_proc where proname='claim_stripe_event') as abonnement_099_actif;
