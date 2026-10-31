-- Felexia Pro: managed counters; existing document numbers remain unchanged.
-- Apply after 093/094/095/096. All changes are transactional.
begin;

do $$ declare t text; begin
  foreach t in array array['accounting_entries','customer_credit_notes','customer_invoices','customer_payments','customer_reminders','purchase_documents','sales_documents','supplier_invoices','supplier_payments','third_parties'] loop
    if to_regclass('public.'||t) is not null then execute format('lock table public.%I in share row exclusive mode',t);end if;
  end loop;
end $$;
alter table public.numbering_sequences add column if not exists revision bigint not null default 0;

create table if not exists public.numbering_number_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counter_key text not null,period_start date not null,prefix text not null,
  issued_number bigint not null check(issued_number>=0),document_number text not null,
  document_id uuid,document_table text not null,actor_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique(organization_id,counter_key,prefix,document_number)
);
create index if not exists numbering_issues_floor_idx on public.numbering_number_issues(organization_id,counter_key,prefix,issued_number desc);
create table if not exists public.numbering_counter_changes (
  id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
  counter_key text not null,period_start date not null,prefix text not null,
  previous_next_number bigint not null,next_number bigint not null,reason text not null,
  actor_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp()
);
create index if not exists numbering_counter_changes_org_idx on public.numbering_counter_changes(organization_id,created_at desc);
alter table public.numbering_number_issues enable row level security;
alter table public.numbering_counter_changes enable row level security;
drop policy if exists numbering_changes_admin_read on public.numbering_counter_changes;
create policy numbering_changes_admin_read on public.numbering_counter_changes for select to authenticated using(app_private.is_org_admin(organization_id));
drop policy if exists numbering_issues_admin_read on public.numbering_number_issues;
create policy numbering_issues_admin_read on public.numbering_number_issues for select to authenticated using(app_private.is_org_admin(organization_id));
revoke all on public.numbering_number_issues,public.numbering_counter_changes from public,anon,authenticated;
grant select on public.numbering_number_issues,public.numbering_counter_changes to authenticated;

create or replace function app_private.numbering_descriptor(p_organization_id uuid,p_counter_key text,p_period date)
returns jsonb language plpgsql stable security definer set search_path=public,app_private as $$
declare
  d date:=date_trunc('month',coalesce(p_period,current_date))::date;
  k text;base text;title text;grp text;tbl text;col text;datecol text;subtypecol text;subtype text;j record;jid uuid;
begin
  if d<date '1900-01-01' or d>date '9999-12-31' then raise exception 'NUMBERING_INVALID_PERIOD' using errcode='22023';end if;
  case p_counter_key
    when 'customer_invoice' then k:='CUSTOMER_INVOICE';base:='FAC-';title:='Factures clients';grp:='sales';tbl:='customer_invoices';col:='invoice_number';datecol:='invoice_date';
    when 'customer_payment' then k:='CUSTOMER_PAYMENT';base:='REG-';title:='Règlements clients';grp:='sales';tbl:='customer_payments';col:='payment_number';datecol:='payment_date';
    when 'customer_credit_note' then k:='CUSTOMER_CREDIT_NOTE';base:='AV-';title:='Avoirs clients';grp:='sales';tbl:='customer_credit_notes';col:='credit_note_number';datecol:='credit_note_date';
    when 'customer_reminder' then k:='CUSTOMER_REMINDER';base:='REL-';title:='Relances clients';grp:='sales';tbl:='customer_reminders';col:='reminder_number';datecol:='reminder_date';
    when 'sales_quote' then k:='SALES_QUOTE';base:='DEV-';title:='Devis clients';grp:='sales';tbl:='sales_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='quote';
    when 'sales_order' then k:='SALES_ORDER';base:='CMD-';title:='Commandes clients';grp:='sales';tbl:='sales_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='order';
    when 'sales_delivery' then k:='SALES_DELIVERY';base:='BL-';title:='Bons de livraison';grp:='sales';tbl:='sales_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='delivery_note';
    when 'sales_return' then k:='SALES_RETURN';base:='BR-';title:='Bons de retour';grp:='sales';tbl:='sales_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='return_note';
    when 'supplier_invoice' then k:='SUPPLIER_INVOICE';base:='FF-';title:='Factures fournisseurs';grp:='purchases';tbl:='supplier_invoices';col:='invoice_number';datecol:='invoice_date';
    when 'supplier_payment' then k:='SUPPLIER_PAYMENT';base:='RFO-';title:='Règlements fournisseurs';grp:='purchases';tbl:='supplier_payments';col:='payment_number';datecol:='payment_date';
    when 'purchase_order' then k:='PURCHASE_ORDER';base:='CF-';title:='Commandes fournisseurs';grp:='purchases';tbl:='purchase_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='supplier_order';
    when 'purchase_receipt' then k:='PURCHASE_RECEIPT';base:='REC-';title:='Bons de réception';grp:='purchases';tbl:='purchase_documents';col:='document_number';datecol:='document_date';subtypecol:='document_type';subtype:='supplier_receipt';
    when 'customer' then k:='THIRD_PARTY_customer';base:='CU';title:='Codes clients';grp:='contacts';tbl:='third_parties';col:='code';datecol:='created_at';
    when 'supplier' then k:='THIRD_PARTY_supplier';base:='SU';title:='Codes fournisseurs';grp:='contacts';tbl:='third_parties';col:='code';datecol:='created_at';
    when 'prospect' then k:='THIRD_PARTY_prospect';base:='PR';title:='Codes prospects';grp:='contacts';tbl:='third_parties';col:='code';datecol:='created_at';
    else
      if p_counter_key !~ '^journal:[0-9a-fA-F-]{36}$' then raise exception 'NUMBERING_UNKNOWN_COUNTER' using errcode='22023';end if;
      begin jid:=substring(p_counter_key from 9)::uuid;exception when invalid_text_representation then raise exception 'NUMBERING_UNKNOWN_COUNTER' using errcode='22023';end;
      if to_regclass('public.accounting_journals') is null then raise exception 'NUMBERING_UNKNOWN_COUNTER' using errcode='22023';end if;
      select code,name into j from public.accounting_journals where id=jid and organization_id=p_organization_id;
      if not found then raise exception 'NUMBERING_UNKNOWN_COUNTER' using errcode='22023';end if;
      d:=date_trunc('year',d)::date;
      return jsonb_build_object('counter_key',p_counter_key,'label','Journal '||j.code||' · '||j.name,'group_key','accounting',
        'sequence_key','ACCOUNTING_JOURNAL_'||jid||'_'||to_char(d,'YYYY'),'prefix',j.code||'-'||to_char(d,'YYYY')||'-',
        'base_prefix',j.code||'-','period_start',d,'period_label',to_char(d,'YYYY'),'reset_period','yearly','padding',5,
        'table_name','accounting_entries','number_column','entry_number','date_column','entry_date','subtype_column','journal_id','subtype_value',jid::text);
  end case;
  return jsonb_build_object('counter_key',p_counter_key,'label',title,'group_key',grp,'sequence_key',k||'_'||to_char(d,'YYMM'),
    'prefix',base||to_char(d,'YYMM')||'-','base_prefix',base,'period_start',d,'period_label',to_char(d,'YYYY-MM'),'reset_period','monthly','padding',5,
    'table_name',tbl,'number_column',col,'date_column',datecol,'subtype_column',subtypecol,'subtype_value',subtype);
end $$;

create or replace function app_private.assert_numbering_actor(p_organization_id uuid,p_counter_key text)
returns void language plpgsql stable security definer set search_path=public,app_private as $$
begin
  -- Trusted imports may have no auth actor. Their outer business write still undergoes document RLS.
  -- SECURITY DEFINER changes current_user, but not the caller's SET ROLE GUC.
  -- Deny invalid API actors before any lookup can reveal an issued number.
  if auth.uid() is null and coalesce(current_setting('role',true),'none') in ('anon','authenticated') then raise exception 'NUMBERING_MEMBERSHIP_REQUIRED' using errcode='42501';end if;
  if auth.uid() is not null and not app_private.is_org_member(p_organization_id) then raise exception 'NUMBERING_MEMBERSHIP_REQUIRED' using errcode='42501';end if;
  if auth.uid() is not null and app_private.is_operator_org_member(p_organization_id) and p_counter_key not in
    ('customer','supplier','customer_invoice','supplier_invoice','customer_payment','supplier_payment','customer_credit_note') then
    raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';
  end if;
end $$;
create or replace function app_private.numbering_lock(p_organization_id uuid,p_counter_key text,p_prefix text)
returns void language sql volatile security definer set search_path=public,app_private as $$
  select pg_advisory_xact_lock(hashtextextended(p_organization_id::text||'|'||p_counter_key||'|'||p_prefix,0));
$$;
create or replace function app_private.numbering_max_used(p_organization_id uuid,d jsonb)
returns bigint language plpgsql volatile security definer set search_path=public,app_private as $$
declare existing_max bigint:=0;issued_max bigint:=0;filter text:='';
begin
  if to_regclass('public.'||(d->>'table_name')) is not null then
    if d->>'subtype_column' is not null then filter:=format(' and %I::text=$4',d->>'subtype_column');end if;
    execute format('select coalesce(max(case when length(ltrim(suffix,''0''))>10 then 2147483647 else least(coalesce(nullif(ltrim(suffix,''0''),''''),''0'')::bigint,2147483647) end),0) from (select substring(%I from $2) suffix from public.%I where organization_id=$1 and left(%I,length($3))=$3%s) source where suffix ~ ''^[0-9]+$''',
      d->>'number_column',d->>'table_name',d->>'number_column',filter) into existing_max using p_organization_id,length(d->>'prefix')+1,d->>'prefix',d->>'subtype_value';
  end if;
  select coalesce(max(issued_number),0) into issued_max from public.numbering_number_issues where organization_id=p_organization_id and counter_key=d->>'counter_key' and prefix=d->>'prefix';
  return greatest(existing_max,issued_max);
end $$;
create or replace function app_private.numbering_snapshot(p_organization_id uuid,p_counter_key text,p_period date)
returns jsonb language plpgsql volatile security definer set search_path=public,app_private as $$
declare d jsonb;s public.numbering_sequences%rowtype;max_used bigint;effective_next bigint;rev text;last_actual text;
begin
  d:=app_private.numbering_descriptor(p_organization_id,p_counter_key,p_period);
  select * into s from public.numbering_sequences where organization_id=p_organization_id and document_type=d->>'sequence_key' and current_year=extract(year from (d->>'period_start')::date)::integer;
  max_used:=app_private.numbering_max_used(p_organization_id,d);effective_next:=greatest(coalesce(s.next_number,1)::bigint,max_used+1);
  rev:=md5(p_organization_id::text||':'||p_counter_key||':'||(d->>'period_start')||':'||coalesce(s.id::text,'new')||':'||coalesce(s.revision::text,'0')||':'||max_used||':'||(d->>'prefix'));
  select document_number into last_actual from public.numbering_number_issues where organization_id=p_organization_id and counter_key=p_counter_key and prefix=d->>'prefix' and issued_number=max_used order by created_at desc,id desc limit 1;
  return (d-array['sequence_key','table_name','number_column','date_column','subtype_column','subtype_value','base_prefix'])||jsonb_build_object(
    'next_number',effective_next,'minimum_next_number',max_used+1,'max_used_number',max_used,
    'next_document_number',(d->>'prefix')||lpad(effective_next::text,greatest(5,length(effective_next::text)),'0'),
    'last_document_number',last_actual,
    'revision',rev,'is_initialized',s.id is not null,'is_exhausted',max_used+1>2147483646);
end $$;

create or replace function app_private.guard_numbering_counter_write()
returns trigger language plpgsql security invoker set search_path=public,app_private as $$
declare allocator_owner text;
begin
  select pg_get_userbyid(proowner) into allocator_owner from pg_proc where oid='app_private.allocate_document_number(uuid,text,date,uuid,text)'::regprocedure;
  if current_user<>allocator_owner then
    if tg_op='DELETE' then raise exception 'NUMBERING_RPC_REQUIRED' using errcode='42501';end if;
    if pg_trigger_depth()<2 or new.document_type not in ('DEV','CMD','BL','FAC') or not app_private.is_org_member(new.organization_id) then raise exception 'NUMBERING_RPC_REQUIRED' using errcode='42501';end if;
    if tg_op='INSERT' and (new.next_number<>2 or new.prefix<>new.document_type||'-') then raise exception 'NUMBERING_RPC_REQUIRED' using errcode='42501';end if;
    if tg_op='UPDATE' and (new.next_number<>old.next_number+1 or (to_jsonb(new)-array['next_number','updated_at','revision']) is distinct from (to_jsonb(old)-array['next_number','updated_at','revision'])) then raise exception 'NUMBERING_RPC_REQUIRED' using errcode='42501';end if;
  end if;
  if tg_op='DELETE' then return old;end if;
  new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;new.updated_at:=clock_timestamp();return new;
end $$;
create or replace function app_private.allocate_document_number(p_organization_id uuid,p_counter_key text,p_period date,p_document_id uuid,p_document_table text)
returns text language plpgsql volatile security definer set search_path=public,app_private as $$
declare d jsonb;s public.numbering_sequences%rowtype;chosen bigint;result_number text;
begin
  perform app_private.assert_numbering_actor(p_organization_id,p_counter_key);
  d:=app_private.numbering_descriptor(p_organization_id,p_counter_key,p_period);
  perform app_private.numbering_lock(p_organization_id,p_counter_key,d->>'prefix');
  insert into public.numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values(p_organization_id,d->>'sequence_key',d->>'prefix',extract(year from (d->>'period_start')::date)::integer,1) on conflict(organization_id,document_type,current_year) do nothing;
  select * into s from public.numbering_sequences where organization_id=p_organization_id and document_type=d->>'sequence_key' and current_year=extract(year from (d->>'period_start')::date)::integer for update;
  chosen:=greatest(s.next_number::bigint,app_private.numbering_max_used(p_organization_id,d)+1);
  if chosen>2147483646 then raise exception 'NUMBERING_EXHAUSTED' using errcode='22003';end if;
  result_number:=(d->>'prefix')||lpad(chosen::text,greatest(5,length(chosen::text)),'0');
  update public.numbering_sequences set next_number=(chosen+1)::integer,prefix=d->>'prefix' where id=s.id;
  insert into public.numbering_number_issues(organization_id,counter_key,period_start,prefix,issued_number,document_number,document_id,document_table,actor_id) values(p_organization_id,p_counter_key,(d->>'period_start')::date,d->>'prefix',chosen,result_number,p_document_id,p_document_table,auth.uid());
  return result_number;
end $$;
create or replace function app_private.register_document_number(p_organization_id uuid,p_counter_key text,p_date date,p_number text,p_document_id uuid,p_document_table text,p_sync_counter boolean default true)
returns void language plpgsql volatile security definer set search_path=public,app_private as $$
declare d jsonb;m text[];issue_period date;actual_prefix text;suffix text;issued bigint;yy integer;mm integer;issue_key text:=p_counter_key;
begin
  -- Only the migration's private, non-trigger ledger backfill has no actor
  -- check. Every business trigger and every counter synchronization checks it.
  if p_sync_counter or pg_trigger_depth()>0 then perform app_private.assert_numbering_actor(p_organization_id,p_counter_key);end if;
  if p_number is null or btrim(p_number)='' then return;end if;
  -- A contact can change category without changing its original code. Reserve
  -- by that code family, while permissions above use its current business type.
  if p_counter_key in ('customer','supplier','prospect') then
    issue_key:=case when p_number ~ '^CU[0-9]{4}-[0-9]+$' then 'customer' when p_number ~ '^SU[0-9]{4}-[0-9]+$' then 'supplier' when p_number ~ '^PR[0-9]{4}-[0-9]+$' then 'prospect' else p_counter_key end;
  end if;
  d:=app_private.numbering_descriptor(p_organization_id,issue_key,p_date);
  if d->>'reset_period'='yearly' then
    m:=regexp_match(p_number,'^(.+)-([0-9]{4})-([0-9]+)$');if m is null then return;end if;
    yy:=m[2]::integer;if yy<1900 or yy>9999 then return;end if;
    issue_period:=make_date(yy,1,1);actual_prefix:=m[1]||'-'||m[2]||'-';suffix:=m[3];
  else
    if left(p_number,length(d->>'base_prefix'))<>d->>'base_prefix' then return;end if;
    m:=regexp_match(substring(p_number from length(d->>'base_prefix')+1),'^([0-9]{2})([0-9]{2})-([0-9]+)$');if m is null then return;end if;
    yy:=(extract(year from coalesce(p_date,current_date))::integer/100)*100+m[1]::integer;mm:=m[2]::integer;
    if mm<1 or mm>12 or yy<1900 or yy>9999 then return;end if;
    issue_period:=make_date(yy,mm,1);actual_prefix:=(d->>'base_prefix')||m[1]||m[2]||'-';suffix:=m[3];
  end if;
  suffix:=coalesce(nullif(ltrim(suffix,'0'),''),'0');issued:=case when length(suffix)>10 then 2147483647 else least(suffix::bigint,2147483647) end;
  perform app_private.numbering_lock(p_organization_id,issue_key,actual_prefix);
  if p_sync_counter and exists(select 1 from public.numbering_number_issues where organization_id=p_organization_id and counter_key=issue_key and prefix=actual_prefix and document_number=p_number and document_id is distinct from p_document_id) then raise exception 'NUMBERING_ALREADY_ISSUED' using errcode='23505';end if;
  insert into public.numbering_number_issues(organization_id,counter_key,period_start,prefix,issued_number,document_number,document_id,document_table,actor_id) values(p_organization_id,issue_key,issue_period,actual_prefix,issued,p_number,p_document_id,p_document_table,auth.uid()) on conflict do nothing;
  if p_sync_counter then
    d:=app_private.numbering_descriptor(p_organization_id,issue_key,issue_period);
    -- A renamed journal's historic prefix is recorded but never becomes its current prefix.
    if d->>'prefix'=actual_prefix then
      insert into public.numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values(p_organization_id,d->>'sequence_key',actual_prefix,extract(year from issue_period)::integer,least(issued+1,2147483647)::integer)
      on conflict(organization_id,document_type,current_year) do update set next_number=greatest(numbering_sequences.next_number,excluded.next_number) where numbering_sequences.next_number<excluded.next_number;
    end if;
  end if;
end $$;
create or replace function app_private.assign_document_number(p_organization_id uuid,p_counter_key text,p_date date,p_existing text,p_document_id uuid,p_document_table text)
returns text language plpgsql volatile security definer set search_path=public,app_private as $$
begin
  perform app_private.assert_numbering_actor(p_organization_id,p_counter_key);
  if p_existing is not null and length(btrim(p_existing))>0 then
    if auth.uid() is not null and app_private.is_operator_org_member(p_organization_id) then raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';end if;
    perform app_private.register_document_number(p_organization_id,p_counter_key,p_date,p_existing,p_document_id,p_document_table,true);return p_existing;
  end if;
  return app_private.allocate_document_number(p_organization_id,p_counter_key,p_date,p_document_id,p_document_table);
end $$;

-- Existing trigger identities and original prefixes remain unchanged.
create or replace function public.generate_customer_invoice_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.invoice_number:=app_private.assign_document_number(new.organization_id,'customer_invoice',coalesce(new.invoice_date,current_date),new.invoice_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_customer_payment_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.payment_number:=app_private.assign_document_number(new.organization_id,'customer_payment',coalesce(new.payment_date,current_date),new.payment_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_customer_credit_note_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.credit_note_number:=app_private.assign_document_number(new.organization_id,'customer_credit_note',coalesce(new.credit_note_date,current_date),new.credit_note_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_customer_reminder_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.reminder_number:=app_private.assign_document_number(new.organization_id,'customer_reminder',coalesce(new.reminder_date,current_date),new.reminder_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_supplier_invoice_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.invoice_number:=app_private.assign_document_number(new.organization_id,'supplier_invoice',coalesce(new.invoice_date,current_date),new.invoice_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_supplier_payment_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.payment_number:=app_private.assign_document_number(new.organization_id,'supplier_payment',coalesce(new.payment_date,current_date),new.payment_number,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_sales_document_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare k text;begin
  k:=case new.document_type when 'quote' then 'sales_quote' when 'order' then 'sales_order' when 'delivery_note' then 'sales_delivery' when 'return_note' then 'sales_return' end;
  new.document_number:=app_private.assign_document_number(new.organization_id,k,coalesce(new.document_date,current_date),new.document_number,new.id,tg_table_name);return new;
end $$;
create or replace function public.generate_purchase_document_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare k text;begin
  k:=case new.document_type when 'supplier_order' then 'purchase_order' when 'supplier_receipt' then 'purchase_receipt' end;
  new.document_number:=app_private.assign_document_number(new.organization_id,k,coalesce(new.document_date,current_date),new.document_number,new.id,tg_table_name);return new;
end $$;
create or replace function public.generate_third_party_code()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.primary_type:=coalesce(new.primary_type,new.types[1],'prospect');new.code:=app_private.assign_document_number(new.organization_id,new.primary_type,(now() at time zone 'Africa/Casablanca')::date,new.code,new.id,tg_table_name);return new;end $$;
create or replace function public.generate_accounting_entry_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.entry_number:=app_private.assign_document_number(new.organization_id,'journal:'||new.journal_id,coalesce(new.entry_date,current_date),new.entry_number,new.id,tg_table_name);return new;end $$;

create or replace function app_private.guard_operator_numbering_write()
returns trigger language plpgsql security invoker set search_path=public,app_private as $$
declare allocator_owner text;
begin
  select pg_get_userbyid(proowner) into allocator_owner from pg_proc where oid='app_private.allocate_document_number(uuid,text,date,uuid,text)'::regprocedure;
  if pg_trigger_depth()>=2 and current_user=allocator_owner then return new;end if;
  if app_private.is_operator_org_member(new.organization_id) or (tg_op='UPDATE' and app_private.is_operator_org_member(old.organization_id)) then
    if pg_trigger_depth()<2 or new.document_type !~ '^(CUSTOMER_(INVOICE|PAYMENT)|THIRD_PARTY_(customer|supplier))_[0-9]{4}$' then raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';end if;
    if tg_op='UPDATE' and (new.next_number<>old.next_number+1 or (to_jsonb(new)-array['next_number','updated_at','revision']) is distinct from (to_jsonb(old)-array['next_number','updated_at','revision'])) then raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';end if;
  end if;return new;
end $$;
drop trigger if exists numbering_counter_write_guard_v6 on public.numbering_sequences;
create trigger numbering_counter_write_guard_v6 before insert or update or delete on public.numbering_sequences for each row execute function app_private.guard_numbering_counter_write();

-- Record old numbers before a change/deletion as well as explicitly assigned numbers.
create or replace function app_private.track_numbered_document_history()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare payload jsonb;k text;d date;source_number text;
begin
  if not exists(select 1 from public.organizations where id=old.organization_id) then return old;end if;
  payload:=to_jsonb(old);k:=tg_argv[0];
  if k='@sales' then k:=case payload->>'document_type' when 'quote' then 'sales_quote' when 'order' then 'sales_order' when 'delivery_note' then 'sales_delivery' when 'return_note' then 'sales_return' end;end if;
  if k='@purchase' then k:=case payload->>'document_type' when 'supplier_order' then 'purchase_order' when 'supplier_receipt' then 'purchase_receipt' end;end if;
  if k='@contact' then k:=coalesce(payload->>'primary_type',payload->'types'->>0,'prospect');end if;
  if k='@journal' then k:='journal:'||(payload->>'journal_id');end if;
  d:=coalesce((payload->>tg_argv[2])::date,current_date);source_number:=payload->>tg_argv[1];
  if k is not null then perform app_private.register_document_number(old.organization_id,k,d,source_number,old.id,tg_table_name,false);end if;
  if tg_op='DELETE' then return old;end if;
  payload:=to_jsonb(new);k:=tg_argv[0];
  if app_private.is_operator_org_member(new.organization_id) and (payload->>tg_argv[1]) is distinct from (to_jsonb(old)->>tg_argv[1]) then raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';end if;
  if k='@sales' then k:=case payload->>'document_type' when 'quote' then 'sales_quote' when 'order' then 'sales_order' when 'delivery_note' then 'sales_delivery' when 'return_note' then 'sales_return' end;end if;
  if k='@purchase' then k:=case payload->>'document_type' when 'supplier_order' then 'purchase_order' when 'supplier_receipt' then 'purchase_receipt' end;end if;
  if k='@contact' then k:=coalesce(payload->>'primary_type',payload->'types'->>0,'prospect');end if;
  if k='@journal' then k:='journal:'||(payload->>'journal_id');end if;
  d:=coalesce((payload->>tg_argv[2])::date,current_date);
  if k is not null then perform app_private.register_document_number(new.organization_id,k,d,payload->>tg_argv[1],new.id,tg_table_name,true);end if;
  return new;
end $$;

-- Backfill only the ledger. Existing counters and business numbers are not changed.
do $$ declare k text;d jsonb;q text;r record;j record;begin
  foreach k in array array['customer_invoice','customer_payment','customer_credit_note','customer_reminder','sales_quote','sales_order','sales_delivery','sales_return','supplier_invoice','supplier_payment','purchase_order','purchase_receipt','customer','supplier','prospect'] loop
    d:=app_private.numbering_descriptor(null,k,current_date);
    if to_regclass('public.'||(d->>'table_name')) is null then continue;end if;
    q:=format('select id,organization_id,%I::text as number,%I::date as number_date from public.%I',d->>'number_column',d->>'date_column',d->>'table_name');
    if d->>'subtype_column' is not null then q:=q||format(' where %I::text=%L',d->>'subtype_column',d->>'subtype_value');end if;
    if k in ('customer','supplier','prospect') then q:=q||format(' where left(code,2)=%L',d->>'base_prefix');end if;
    for r in execute q loop perform app_private.register_document_number(r.organization_id,k,r.number_date,r.number,r.id,d->>'table_name',false);end loop;
  end loop;
  if to_regclass('public.accounting_entries') is not null and to_regclass('public.accounting_journals') is not null then
    for j in select id,organization_id from public.accounting_journals loop
      for r in execute 'select id,organization_id,entry_number::text number,entry_date::date number_date from public.accounting_entries where organization_id=$1 and journal_id=$2' using j.organization_id,j.id loop
        perform app_private.register_document_number(r.organization_id,'journal:'||j.id,r.number_date,r.number,r.id,'accounting_entries',false);
      end loop;
    end loop;
  end if;
end $$;

do $$ declare item record;begin
  for item in select * from (values
    ('customer_invoices','customer_invoice','invoice_number','invoice_date'),
    ('customer_payments','customer_payment','payment_number','payment_date'),
    ('customer_credit_notes','customer_credit_note','credit_note_number','credit_note_date'),
    ('customer_reminders','customer_reminder','reminder_number','reminder_date'),
    ('sales_documents','@sales','document_number','document_date'),
    ('purchase_documents','@purchase','document_number','document_date'),
    ('supplier_invoices','supplier_invoice','invoice_number','invoice_date'),
    ('supplier_payments','supplier_payment','payment_number','payment_date'),
    ('third_parties','@contact','code','created_at'),
    ('accounting_entries','@journal','entry_number','entry_date')
  ) as specs(table_name,counter_key,number_column,date_column) loop
    if to_regclass('public.'||item.table_name) is null then continue;end if;
    execute format('drop trigger if exists numbering_document_history_v6 on public.%I',item.table_name);
    execute format('create trigger numbering_document_history_v6 before update or delete on public.%I for each row execute function app_private.track_numbered_document_history(%L,%L,%L)',item.table_name,item.counter_key,item.number_column,item.date_column);
  end loop;
  if to_regclass('public.accounting_entries') is not null then
    execute 'drop trigger if exists accounting_entries_number_v6 on public.accounting_entries';
    execute 'create trigger accounting_entries_number_v6 before insert on public.accounting_entries for each row execute function public.generate_accounting_entry_number()';
  end if;
end $$;

create or replace function public.get_numbering_counters(p_organization_id uuid,p_period date)
returns jsonb language plpgsql volatile security definer set search_path=public,app_private as $$
declare result jsonb:='[]'::jsonb;k text;j record;begin
  if not app_private.is_org_admin(p_organization_id) then raise exception 'NUMBERING_ADMIN_REQUIRED' using errcode='42501';end if;
  if p_period is null or p_period<date '1900-01-01' or p_period>date '2199-12-31' then raise exception 'NUMBERING_INVALID_PERIOD' using errcode='22023';end if;
  foreach k in array array['customer_invoice','customer_payment','customer_credit_note','customer_reminder','supplier_invoice','supplier_payment','customer','supplier','sales_quote','sales_order','sales_delivery','sales_return','purchase_order','purchase_receipt','prospect'] loop
    result:=result||jsonb_build_array(app_private.numbering_snapshot(p_organization_id,k,p_period));
  end loop;
  if to_regclass('public.accounting_journals') is not null then
    for j in select id from public.accounting_journals where organization_id=p_organization_id order by code,id loop
      result:=result||jsonb_build_array(app_private.numbering_snapshot(p_organization_id,'journal:'||j.id,p_period));
    end loop;
  end if;return result;
end $$;
create or replace function public.correct_numbering_counter(p_organization_id uuid,p_counter_key text,p_period date,p_next_number integer,p_expected_revision text,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path=public,app_private as $$
declare d jsonb;snapshot jsonb;s public.numbering_sequences%rowtype;begin
  if not app_private.is_org_admin(p_organization_id) then raise exception 'NUMBERING_ADMIN_REQUIRED' using errcode='42501';end if;
  if p_period is null or p_period<date '1900-01-01' or p_period>date '2199-12-31' then raise exception 'NUMBERING_INVALID_PERIOD' using errcode='22023';end if;
  if p_next_number is null or p_next_number<1 or p_next_number>2147483646 then raise exception 'NUMBERING_INVALID_NEXT_NUMBER' using errcode='22023';end if;
  if p_reason is null or length(btrim(p_reason))<5 or length(btrim(p_reason))>500 then raise exception 'NUMBERING_REASON_REQUIRED' using errcode='22023';end if;
  d:=app_private.numbering_descriptor(p_organization_id,p_counter_key,p_period);perform app_private.numbering_lock(p_organization_id,p_counter_key,d->>'prefix');
  select * into s from public.numbering_sequences where organization_id=p_organization_id and document_type=d->>'sequence_key' and current_year=extract(year from (d->>'period_start')::date)::integer for update;
  snapshot:=app_private.numbering_snapshot(p_organization_id,p_counter_key,p_period);
  if p_expected_revision is null or p_expected_revision<>snapshot->>'revision' then raise exception 'NUMBERING_CONFLICT' using errcode='40001';end if;
  if p_next_number<(snapshot->>'minimum_next_number')::bigint then raise exception 'NUMBERING_BELOW_USED_NUMBER' using errcode='22023';end if;
  insert into public.numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values(p_organization_id,d->>'sequence_key',d->>'prefix',extract(year from (d->>'period_start')::date)::integer,p_next_number)
    on conflict(organization_id,document_type,current_year) do update set prefix=excluded.prefix,next_number=excluded.next_number;
  insert into public.numbering_counter_changes(organization_id,counter_key,period_start,prefix,previous_next_number,next_number,reason,actor_id) values(p_organization_id,p_counter_key,(d->>'period_start')::date,d->>'prefix',(snapshot->>'next_number')::bigint,p_next_number,btrim(p_reason),auth.uid());
  return app_private.numbering_snapshot(p_organization_id,p_counter_key,p_period);
end $$;
create or replace function public.get_numbering_counter_history(p_organization_id uuid,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=public,app_private as $$
declare result jsonb;begin
  if not app_private.is_org_admin(p_organization_id) then raise exception 'NUMBERING_ADMIN_REQUIRED' using errcode='42501';end if;
  select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc,row_value.id desc),'[]'::jsonb) into result from (
    select id,counter_key,period_start,prefix,previous_next_number,next_number,reason,actor_id,created_at from public.numbering_counter_changes where organization_id=p_organization_id order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,20),100))
  ) row_value;return result;
end $$;

-- Private helpers are callable only by their owning trigger/RPC.
do $$ declare f record;begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in
    ('numbering_descriptor','assert_numbering_actor','numbering_lock','numbering_max_used','numbering_snapshot','guard_numbering_counter_write','allocate_document_number','register_document_number','assign_document_number','track_numbered_document_history','guard_operator_numbering_write') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('generate_customer_invoice_number','generate_customer_payment_number','generate_customer_credit_note_number','generate_customer_reminder_number','generate_supplier_invoice_number','generate_supplier_payment_number','generate_sales_document_number','generate_purchase_document_number','generate_third_party_code','generate_accounting_entry_number') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
revoke all on function public.get_numbering_counters(uuid,date),public.correct_numbering_counter(uuid,text,date,integer,text,text),public.get_numbering_counter_history(uuid,integer) from public,anon;
grant execute on function public.get_numbering_counters(uuid,date),public.correct_numbering_counter(uuid,text,date,integer,text,text),public.get_numbering_counter_history(uuid,integer) to authenticated;
commit;

-- Safe verification after applying this migration in the intended project.
select to_regprocedure('public.correct_numbering_counter(uuid,text,date,integer,text,text)') is not null
  and exists(select 1 from pg_trigger where tgrelid='public.numbering_sequences'::regclass and tgname='numbering_counter_write_guard_v6' and not tgisinternal)
  and position('app_private.assign_document_number' in pg_get_functiondef('public.generate_customer_invoice_number()'::regprocedure))>0 as numerotation_097_active;
