-- Essential supplier credit notes: received credits, never synthetic cash refunds.
-- Apply after 098, 099 and 100. No existing financial amount is rewritten.
begin;
alter table public.supplier_invoices add column if not exists credit_amount numeric(14,2) not null default 0;
create table if not exists public.supplier_credit_notes(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 credit_note_number text not null, supplier_credit_note_number text not null, supplier_id uuid not null references public.third_parties(id),
 source_invoice_id uuid references public.supplier_invoices(id), source_type text not null default 'manual',credit_note_date date not null default current_date,
 status text not null default 'draft' check(status in('draft','validated','partially_applied','applied','cancelled')),
 subtotal_ht numeric(14,2) not null default 0,discount_total numeric(14,2) not null default 0,tax_total numeric(14,2) not null default 0,total_ttc numeric(14,2) not null default 0,
 applied_amount numeric(14,2) not null default 0,available_amount numeric(14,2) not null default 0,currency text not null default 'MAD' check(currency='MAD'),
 reason text,notes text,internal_notes text,created_by uuid references public.profiles(id),validated_at timestamptz,cancelled_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 unique(organization_id,credit_note_number),check(total_ttc>=0 and applied_amount>=0 and available_amount>=0 and applied_amount<=total_ttc),check(btrim(supplier_credit_note_number)<>'')
);
create unique index if not exists supplier_credit_external_ref_v11 on public.supplier_credit_notes(organization_id,supplier_id,supplier_credit_note_number) where status<>'cancelled';
create table if not exists public.supplier_credit_note_lines(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 credit_note_id uuid not null references public.supplier_credit_notes(id) on delete cascade,source_invoice_line_id uuid references public.supplier_invoice_lines(id),
 line_order integer not null default 1,product_id uuid references public.products(id),product_name text,description text not null,
 quantity numeric(14,3) not null default 1,unit_id uuid references public.units(id),unit_name text,unit_price_ht numeric(14,2) not null default 0,
 discount_rate numeric(5,2) not null default 0,tax_rate_id uuid references public.tax_rates(id),tax_rate numeric(5,2) not null default 0,
 subtotal_ht numeric(14,2) not null default 0,discount_amount numeric(14,2) not null default 0,tax_amount numeric(14,2) not null default 0,total_ttc numeric(14,2) not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(quantity>0 and unit_price_ht>=0 and discount_rate between 0 and 100 and tax_rate between 0 and 100)
);
create table if not exists public.supplier_credit_note_applications(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 credit_note_id uuid not null references public.supplier_credit_notes(id) on delete cascade,invoice_id uuid not null references public.supplier_invoices(id),
 supplier_id uuid not null references public.third_parties(id),application_date date not null default current_date,
 amount numeric(14,2) not null check(amount>0),notes text,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),cancelled_at timestamptz
);
alter table public.supplier_credit_note_applications add column if not exists updated_at timestamptz not null default now();
create index if not exists supplier_credit_note_org_date_v11 on public.supplier_credit_notes(organization_id,credit_note_date desc);
create index if not exists supplier_credit_note_lines_parent_v11 on public.supplier_credit_note_lines(organization_id,credit_note_id);
create index if not exists supplier_credit_note_applications_parent_v11 on public.supplier_credit_note_applications(organization_id,credit_note_id,invoice_id);
do $$ declare tab text; begin
 foreach tab in array array['supplier_credit_notes','supplier_credit_note_lines','supplier_credit_note_applications'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('drop policy if exists supplier_credit_member_read_v11 on public.%I',tab);
  execute format('drop policy if exists supplier_credit_member_write_v11 on public.%I',tab);
  execute format('create policy supplier_credit_member_read_v11 on public.%I for select to authenticated using(app_private.has_active_org_membership(organization_id))',tab);
  execute format('create policy supplier_credit_member_write_v11 on public.%I for all to authenticated using(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)) with check(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',tab);
  execute format('drop trigger if exists aa_essential_subscription_guard on public.%I',tab);
  execute format('create trigger aa_essential_subscription_guard before insert or update or delete on public.%I for each row execute function app_private.guard_essential_business_write()',tab);
  execute format('drop trigger if exists essential_supplier_credit_updated_v11 on public.%I',tab);
  execute format('create trigger essential_supplier_credit_updated_v11 before update on public.%I for each row execute function public.set_updated_at()',tab);
 end loop;
end $$;
grant select,insert,update,delete on public.supplier_credit_notes,public.supplier_credit_note_lines,public.supplier_credit_note_applications to authenticated;
drop trigger if exists ab_commercial_document_quota on public.supplier_credit_notes;
create trigger ab_commercial_document_quota before insert on public.supplier_credit_notes for each row execute function app_private.guard_commercial_document_quota();

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
    when 'supplier_credit_note' then k:='SUPPLIER_CREDIT_NOTE';base:='AVF-';title:='Avoirs fournisseurs';grp:='purchases';tbl:='supplier_credit_notes';col:='credit_note_number';datecol:='credit_note_date';
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
    ('customer','supplier','customer_invoice','supplier_invoice','customer_payment','supplier_payment','customer_credit_note','supplier_credit_note') then
    raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode='42501';
  end if;
end $$;
create or replace function public.get_numbering_counters(p_organization_id uuid,p_period date)
returns jsonb language plpgsql volatile security definer set search_path=public,app_private as $$
declare result jsonb:='[]'::jsonb;k text;j record;begin
  if not app_private.is_org_admin(p_organization_id) then raise exception 'NUMBERING_ADMIN_REQUIRED' using errcode='42501';end if;
  if p_period is null or p_period<date '1900-01-01' or p_period>date '2199-12-31' then raise exception 'NUMBERING_INVALID_PERIOD' using errcode='22023';end if;
  foreach k in array array['customer_invoice','customer_payment','customer_credit_note','customer_reminder','supplier_invoice','supplier_credit_note','supplier_payment','customer','supplier','sales_quote','sales_order','sales_delivery','sales_return','purchase_order','purchase_receipt','prospect'] loop
    result:=result||jsonb_build_array(app_private.numbering_snapshot(p_organization_id,k,p_period));
  end loop;
  if to_regclass('public.accounting_journals') is not null then
    for j in select id from public.accounting_journals where organization_id=p_organization_id order by code,id loop
      result:=result||jsonb_build_array(app_private.numbering_snapshot(p_organization_id,'journal:'||j.id,p_period));
    end loop;
  end if;return result;
end $$;
create or replace function app_private.finance_source_definition(p_kind text)
returns jsonb language sql immutable security invoker set search_path=public,app_private
as $$ select case p_kind
  when 'customer_invoice' then '{"table":"customer_invoices","amount":"total_ttc"}'::jsonb
  when 'supplier_invoice' then '{"table":"supplier_invoices","amount":"total_ttc"}'::jsonb
  when 'customer_payment' then '{"table":"customer_payments","amount":"amount"}'::jsonb
  when 'supplier_payment' then '{"table":"supplier_payments","amount":"amount"}'::jsonb
  when 'customer_credit_note' then '{"table":"customer_credit_notes","amount":"total_ttc"}'::jsonb
  when 'supplier_credit_note' then '{"table":"supplier_credit_notes","amount":"total_ttc"}'::jsonb
  else null end; $$;
create or replace function public.generate_supplier_credit_note_number()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin new.credit_note_number:=app_private.assign_document_number(new.organization_id,'supplier_credit_note',coalesce(new.credit_note_date,current_date),new.credit_note_number,new.id,tg_table_name);return new;end $$;
revoke all on function public.generate_supplier_credit_note_number() from public,anon,authenticated;
drop trigger if exists supplier_credit_note_number_v11 on public.supplier_credit_notes;
create trigger supplier_credit_note_number_v11 before insert on public.supplier_credit_notes for each row execute function public.generate_supplier_credit_note_number();
drop trigger if exists numbering_document_history_v6 on public.supplier_credit_notes;
create trigger numbering_document_history_v6 before update or delete on public.supplier_credit_notes for each row execute function app_private.track_numbered_document_history('supplier_credit_note','credit_note_number','credit_note_date');

do $$
declare target text;
begin
  foreach target in array array['supplier_credit_notes','supplier_credit_note_lines','supplier_credit_note_applications'] loop
    execute format('drop policy if exists essential_supplier_credit_write_insert_v11 on public.%I',target);
    execute format('drop policy if exists essential_supplier_credit_write_update_v11 on public.%I',target);
    execute format('drop policy if exists essential_supplier_credit_write_delete_v11 on public.%I',target);
    execute format('create policy essential_supplier_credit_write_insert_v11 on public.%I as restrictive for insert to authenticated with check(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_supplier_credit_write_update_v11 on public.%I as restrictive for update to authenticated using(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)) with check(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_supplier_credit_write_delete_v11 on public.%I as restrictive for delete to authenticated using(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)%s)',target,case when target='supplier_credit_note_applications' then ' and false' when target='supplier_credit_notes' then ' and status=''draft''' else '' end);
  end loop;
end $$;

create or replace function app_private.guard_essential_supplier_credit_note()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare note public.supplier_credit_notes%rowtype; row_data jsonb; used numeric; invoice_total numeric; invoice_paid numeric; invoice_used numeric; line_totals record; gross numeric;
begin
  if auth.uid() is not null and (not app_private.has_active_org_membership(case when tg_op='DELETE' then old.organization_id else new.organization_id end) or app_private.is_read_only_org_member(case when tg_op='DELETE' then old.organization_id else new.organization_id end)) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if tg_table_name='supplier_credit_notes' then
    if tg_op='INSERT' and new.status<>'draft' then raise exception 'CREDIT_DRAFT_REQUIRED' using errcode='42501'; end if;
    if tg_op<>'DELETE' and (new.total_ttc::text in ('NaN','Infinity','-Infinity') or new.subtotal_ht::text in ('NaN','Infinity','-Infinity') or new.tax_total::text in ('NaN','Infinity','-Infinity')) then raise exception 'CREDIT_INVALID_TOTAL' using errcode='23514'; end if;
    if tg_op='INSERT' and new.currency<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
    if tg_op='UPDATE' then
      if (old.status<>'draft' and new.status='draft') or (old.status='cancelled' and new.status<>'cancelled') then raise exception 'CREDIT_NOTE_VALIDATED_READ_ONLY' using errcode='42501'; end if;
      if old.status<>'draft' and (to_jsonb(new)-array['applied_amount','available_amount','status','updated_at','notes','internal_notes','cancelled_at']) is distinct from (to_jsonb(old)-array['applied_amount','available_amount','status','updated_at','notes','internal_notes','cancelled_at']) then raise exception 'CREDIT_NOTE_VALIDATED_READ_ONLY' using errcode='42501'; end if;
      select coalesce(sum(amount),0) into used from public.supplier_credit_note_applications where organization_id=new.organization_id and credit_note_id=new.id and cancelled_at is null;
      if new.applied_amount<>used or new.available_amount<>(case when new.status in ('draft','cancelled') then 0 else greatest(new.total_ttc-used,0) end) then raise exception 'CREDIT_BALANCES_MANAGED' using errcode='23514'; end if;
      if new.status='cancelled' and used<>0 then raise exception 'CREDIT_HAS_APPLICATIONS' using errcode='23514'; end if;
      if old.status='draft' and new.status<>'draft' and new.status<>'cancelled' then
        select count(*) n,coalesce(sum(subtotal_ht),0) ht,coalesce(sum(discount_amount),0) discount,coalesce(sum(tax_amount),0) vat,coalesce(sum(total_ttc),0) ttc into line_totals from public.supplier_credit_note_lines where credit_note_id=new.id and organization_id=new.organization_id;
        if line_totals.n=0 or new.total_ttc<=0 or (new.subtotal_ht,new.discount_total,new.tax_total,new.total_ttc) is distinct from (line_totals.ht,line_totals.discount,line_totals.vat,line_totals.ttc) then raise exception 'CREDIT_INVALID_LINES' using errcode='23514'; end if;
      end if;
    end if;
    if tg_op<>'INSERT' and exists(select 1 from public.accounting_entries where organization_id=old.organization_id and source_document_type='supplier_credit_note' and source_document_id=old.id and status='posted') then
      if tg_op='DELETE' then raise exception 'CREDIT_NOTE_POSTED_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['applied_amount','available_amount','updated_at','notes','internal_notes']) is distinct from (to_jsonb(old)-array['applied_amount','available_amount','updated_at','notes','internal_notes'])
        and not (new.status in ('validated','partially_applied','applied') and (to_jsonb(new)-array['applied_amount','available_amount','updated_at','notes','internal_notes','status']) is not distinct from (to_jsonb(old)-array['applied_amount','available_amount','updated_at','notes','internal_notes','status'])) then
        raise exception 'CREDIT_NOTE_POSTED_READ_ONLY' using errcode='42501';
      end if;
    end if;
  else
    if tg_table_name='supplier_credit_note_lines' and tg_op='UPDATE' and (new.organization_id is distinct from old.organization_id or new.credit_note_id is distinct from old.credit_note_id) then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
    row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
    select * into note from public.supplier_credit_notes where id=(row_data->>'credit_note_id')::uuid and organization_id=(row_data->>'organization_id')::uuid for update;
    if not found then raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode='23514'; end if;
    if tg_table_name='supplier_credit_note_lines' and note.status<>'draft' then raise exception 'CREDIT_NOTE_LINES_READ_ONLY' using errcode='42501'; end if;
    if tg_table_name='supplier_credit_note_lines' and tg_op<>'DELETE' then
      if new.quantity is null or new.unit_price_ht is null or new.quantity::text in ('NaN','Infinity','-Infinity') or new.unit_price_ht::text in ('NaN','Infinity','-Infinity') or new.discount_rate::text in ('NaN','Infinity','-Infinity') or new.tax_rate::text in ('NaN','Infinity','-Infinity') or new.quantity<=0 or new.unit_price_ht<0 or new.discount_rate not between 0 and 100 or new.tax_rate not between 0 and 100 or nullif(btrim(new.description),'') is null then raise exception 'CREDIT_INVALID_LINES' using errcode='23514'; end if;
      gross:=round(new.quantity*new.unit_price_ht,2); new.discount_amount:=round(gross*new.discount_rate/100,2); new.subtotal_ht:=gross-new.discount_amount; new.tax_amount:=round(new.subtotal_ht*new.tax_rate/100,2); new.total_ttc:=new.subtotal_ht+new.tax_amount;
    end if;
    if tg_table_name='supplier_credit_note_applications' then
      if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.credit_note_id<>old.credit_note_id or new.invoice_id<>old.invoice_id or new.supplier_id<>old.supplier_id) then raise exception 'CREDIT_APPLICATION_RELATION_READ_ONLY' using errcode='42501'; end if;
      if not exists(select 1 from public.supplier_invoices where id=(row_data->>'invoice_id')::uuid and organization_id=note.organization_id and supplier_id=note.supplier_id and currency=note.currency)
        or (row_data->>'supplier_id')::uuid<>note.supplier_id then raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode='23514'; end if;
      if tg_op<>'DELETE' and new.cancelled_at is null then
        if note.status not in ('validated','partially_applied','applied') then raise exception 'CREDIT_NOT_AVAILABLE' using errcode='23514'; end if;
        select coalesce(sum(amount),0) into used from public.supplier_credit_note_applications where credit_note_id=note.id and organization_id=note.organization_id and cancelled_at is null and id<>new.id;
        if used+new.amount>note.total_ttc then raise exception 'CREDIT_INSUFFICIENT_AVAILABLE' using errcode='23514'; end if;
        select total_ttc,paid_amount into invoice_total,invoice_paid from public.supplier_invoices where id=new.invoice_id and organization_id=new.organization_id and status not in ('draft','cancelled') and archived_at is null for update;
        if not found then raise exception 'CREDIT_INVALID_INVOICE' using errcode='23514'; end if;
        select coalesce(sum(amount),0) into invoice_used from public.supplier_credit_note_applications where invoice_id=new.invoice_id and organization_id=new.organization_id and cancelled_at is null and id<>new.id;
        if invoice_used+new.amount>invoice_total-invoice_paid then raise exception 'CREDIT_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.guard_essential_supplier_credit_note() from public,anon;
drop trigger if exists essential_supplier_credit_note_v11 on public.supplier_credit_notes;
create trigger essential_supplier_credit_note_v11 before insert or update or delete on public.supplier_credit_notes for each row execute function app_private.guard_essential_supplier_credit_note();
drop trigger if exists essential_supplier_credit_note_lines_v11 on public.supplier_credit_note_lines;
create trigger essential_supplier_credit_note_lines_v11 before insert or update or delete on public.supplier_credit_note_lines for each row execute function app_private.guard_essential_supplier_credit_note();
drop trigger if exists essential_supplier_credit_note_applications_v11 on public.supplier_credit_note_applications;
create trigger essential_supplier_credit_note_applications_v11 before insert or update or delete on public.supplier_credit_note_applications for each row execute function app_private.guard_essential_supplier_credit_note();

create or replace function public.save_supplier_credit_note_atomic(p_organization_id uuid,p_credit_note_id uuid,p_header jsonb,p_lines jsonb)
returns uuid language plpgsql security invoker set search_path=public,app_private
as $$
declare
  note_id uuid:=p_credit_note_id; supplier uuid; source_invoice uuid; supplier_ref text; duplicate_note uuid; existing public.supplier_credit_notes%rowtype;
  line jsonb; prepared jsonb:='[]'::jsonb; qty numeric; price numeric; discount numeric; rate numeric; ht numeric; vat numeric; ttc numeric; gross numeric;
  total_ht numeric:=0; total_vat numeric:=0; sum_ttc numeric:=0; total_discount numeric:=0; idx integer:=0;
  product uuid; unit uuid; tax uuid; invoice_line uuid;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_header) is distinct from 'object' or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'CREDIT_INVALID_LINES' using errcode='22023'; end if;
  supplier:=nullif(p_header->>'supplier_id','')::uuid; source_invoice:=nullif(p_header->>'source_invoice_id','')::uuid;
  supplier_ref:=nullif(btrim(p_header->>'supplier_credit_note_number'),'');
  if supplier_ref is null then raise exception 'SUPPLIER_CREDIT_REFERENCE_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':supplier-credit-ref:'||supplier::text||':'||supplier_ref,0));
  select id into duplicate_note from public.supplier_credit_notes where organization_id=p_organization_id and supplier_id=supplier and supplier_credit_note_number=supplier_ref and status<>'cancelled' and (note_id is null or id<>note_id) limit 1;
  if duplicate_note is not null then raise exception 'SUPPLIER_CREDIT_REFERENCE_EXISTS' using errcode='23505'; end if;
  if not exists(select 1 from public.third_parties where id=supplier and organization_id=p_organization_id and archived_at is null and status='active' and ('supplier'=any(types) or primary_type='supplier')) then raise exception 'CREDIT_INVALID_CUSTOMER' using errcode='23514'; end if;
  if source_invoice is not null and not exists(select 1 from public.supplier_invoices where id=source_invoice and organization_id=p_organization_id and supplier_id=supplier and status not in ('draft','cancelled') and archived_at is null and currency='MAD') then raise exception 'CREDIT_INVALID_SOURCE' using errcode='23514'; end if;
  if note_id is not null then
    select * into existing from public.supplier_credit_notes where id=note_id and organization_id=p_organization_id and archived_at is null for update;
    if not found or existing.status<>'draft' then raise exception 'CREDIT_DRAFT_REQUIRED' using errcode='42501'; end if;
    if existing.currency<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    idx:=idx+1; qty:=round((line->>'quantity')::numeric,3); price:=round((line->>'unit_price_ht')::numeric,2); discount:=round(coalesce((line->>'discount_rate')::numeric,0),2); rate:=round(coalesce((line->>'tax_rate')::numeric,0),2);
    if qty is null or price is null or qty::text in ('NaN','Infinity','-Infinity') or price::text in ('NaN','Infinity','-Infinity') or discount::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity') or qty<=0 or price<0 or discount not between 0 and 100 or rate not between 0 and 100 or nullif(btrim(line->>'description'),'') is null then raise exception 'CREDIT_INVALID_LINES' using errcode='22023'; end if;
    product:=nullif(line->>'product_id','')::uuid; unit:=nullif(line->>'unit_id','')::uuid; tax:=nullif(line->>'tax_rate_id','')::uuid; invoice_line:=nullif(line->>'source_invoice_line_id','')::uuid;
    if product is not null and not exists(select 1 from public.products where id=product and organization_id=p_organization_id and archived_at is null) then raise exception 'CREDIT_INVALID_PRODUCT' using errcode='23514'; end if;
    if unit is not null and not exists(select 1 from public.units where id=unit and (organization_id=p_organization_id or organization_id is null)) then raise exception 'CREDIT_INVALID_UNIT' using errcode='23514'; end if;
    if tax is not null and not exists(select 1 from public.tax_rates where id=tax and (organization_id=p_organization_id or organization_id is null)) then raise exception 'CREDIT_INVALID_TAX' using errcode='23514'; end if;
    if invoice_line is not null and not exists(select 1 from public.supplier_invoice_lines l join public.supplier_invoices i on i.id=l.invoice_id where l.id=invoice_line and i.organization_id=p_organization_id and i.supplier_id=supplier and (source_invoice is null or i.id=source_invoice)) then raise exception 'CREDIT_INVALID_SOURCE_LINE' using errcode='23514'; end if;
    gross:=round(qty*price,2); ht:=gross-round(gross*discount/100,2); vat:=round(ht*rate/100,2); ttc:=ht+vat;
    total_ht:=total_ht+ht; total_vat:=total_vat+vat; sum_ttc:=sum_ttc+ttc; total_discount:=total_discount+round(gross*discount/100,2);
    prepared:=prepared||jsonb_build_array(jsonb_build_object('line_order',idx,'product_id',product,'product_name',nullif(line->>'product_name',''),'description',btrim(line->>'description'),'quantity',qty,'unit_id',unit,'unit_name',nullif(line->>'unit_name',''),'unit_price_ht',price,'discount_rate',discount,'tax_rate_id',tax,'tax_rate',rate,'subtotal_ht',ht,'discount_amount',round(gross*discount/100,2),'tax_amount',vat,'total_ttc',ttc,'source_invoice_line_id',invoice_line));
  end loop;
  if sum_ttc<=0 then raise exception 'CREDIT_INVALID_TOTAL' using errcode='23514'; end if;
  if note_id is null then
    insert into public.supplier_credit_notes(organization_id,credit_note_number,supplier_credit_note_number,supplier_id,source_invoice_id,source_type,credit_note_date,subtotal_ht,discount_total,tax_total,total_ttc,currency,reason,notes,internal_notes,created_by)
    values(p_organization_id,null,supplier_ref,supplier,source_invoice,coalesce(nullif(p_header->>'source_type',''),'manual'),coalesce(nullif(p_header->>'credit_note_date','')::date,current_date),total_ht,total_discount,total_vat,sum_ttc,'MAD',p_header->>'reason',p_header->>'notes',p_header->>'internal_notes',auth.uid()) returning id into note_id;
  else
    update public.supplier_credit_notes set supplier_id=supplier,supplier_credit_note_number=supplier_ref,source_invoice_id=source_invoice,source_type=coalesce(nullif(p_header->>'source_type',''),'manual'),credit_note_date=coalesce(nullif(p_header->>'credit_note_date','')::date,current_date),subtotal_ht=total_ht,discount_total=total_discount,tax_total=total_vat,total_ttc=sum_ttc,reason=p_header->>'reason',notes=p_header->>'notes',internal_notes=p_header->>'internal_notes' where id=note_id and organization_id=p_organization_id;
    delete from public.supplier_credit_note_lines where organization_id=p_organization_id and credit_note_id=note_id;
  end if;
  insert into public.supplier_credit_note_lines(organization_id,credit_note_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc,source_invoice_line_id)
  select p_organization_id,note_id,x.line_order,x.product_id,x.product_name,x.description,x.quantity,x.unit_id,x.unit_name,x.unit_price_ht,x.discount_rate,x.tax_rate_id,x.tax_rate,x.subtotal_ht,x.discount_amount,x.tax_amount,x.total_ttc,x.source_invoice_line_id
  from jsonb_to_recordset(prepared) as x(line_order integer,product_id uuid,product_name text,description text,quantity numeric,unit_id uuid,unit_name text,unit_price_ht numeric,discount_rate numeric,tax_rate_id uuid,tax_rate numeric,subtotal_ht numeric,discount_amount numeric,tax_amount numeric,total_ttc numeric,source_invoice_line_id uuid);
  return note_id;
end $$;
revoke all on function public.save_supplier_credit_note_atomic(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_supplier_credit_note_atomic(uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function app_private.refresh_supplier_credit_note_balances(p_organization_id uuid,p_credit_note_id uuid)
returns void language plpgsql security invoker set search_path=public,app_private
as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  update public.supplier_credit_notes n set applied_amount=x.amount,available_amount=greatest(n.total_ttc-x.amount,0),status=case when x.amount=0 then 'validated' when x.amount<n.total_ttc then 'partially_applied' else 'applied' end
  from (select coalesce(sum(amount),0) amount from public.supplier_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id and cancelled_at is null) x
  where n.id=p_credit_note_id and n.organization_id=p_organization_id and n.status not in ('draft','cancelled');
  update public.supplier_invoices i set credit_amount=x.amount,remaining_amount=greatest(i.total_ttc-i.paid_amount-x.amount,0),payment_status=case when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid' when i.paid_amount+x.amount>0 then 'partial' else 'unpaid' end,
    status=case when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid' when i.paid_amount+x.amount>0 then 'partially_paid' when i.status in ('paid','partially_paid') then 'validated' else i.status end
  from (select invoice.id,coalesce(sum(a.amount) filter(where a.cancelled_at is null),0) amount from public.supplier_invoices invoice left join public.supplier_credit_note_applications a on a.invoice_id=invoice.id and a.organization_id=p_organization_id where invoice.organization_id=p_organization_id and invoice.id in(select invoice_id from public.supplier_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id) group by invoice.id) x
  where i.id=x.id and i.organization_id=p_organization_id and i.status not in ('draft','cancelled');
end $$;
revoke all on function app_private.refresh_supplier_credit_note_balances(uuid,uuid) from public,anon;
grant execute on function app_private.refresh_supplier_credit_note_balances(uuid,uuid) to authenticated;

create or replace function app_private.refresh_supplier_credit_after_application()
returns trigger language plpgsql security invoker set search_path=public,app_private
as $$
begin
  perform app_private.refresh_supplier_credit_note_balances(case when tg_op='DELETE' then old.organization_id else new.organization_id end,case when tg_op='DELETE' then old.credit_note_id else new.credit_note_id end);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.refresh_supplier_credit_after_application() from public,anon;
drop trigger if exists essential_supplier_credit_application_refresh_v11 on public.supplier_credit_note_applications;
create trigger essential_supplier_credit_application_refresh_v11 after insert or update or delete on public.supplier_credit_note_applications for each row execute function app_private.refresh_supplier_credit_after_application();

create or replace function public.apply_supplier_credit_note_atomic(p_organization_id uuid,p_credit_note_id uuid,p_applications jsonb)
returns void language plpgsql security invoker set search_path=public,app_private
as $$
declare note public.supplier_credit_notes%rowtype; invoice public.supplier_invoices%rowtype; application record; used numeric; wanted numeric;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_applications) is distinct from 'array' or jsonb_array_length(p_applications) not between 1 and 100 then raise exception 'CREDIT_INVALID_APPLICATION' using errcode='22023'; end if;
  select * into note from public.supplier_credit_notes where id=p_credit_note_id and organization_id=p_organization_id and archived_at is null for update;
  if not found or note.status not in ('validated','partially_applied') then raise exception 'CREDIT_NOT_AVAILABLE' using errcode='23514'; end if;
  select coalesce(sum(amount),0) into used from public.supplier_credit_note_applications where organization_id=p_organization_id and credit_note_id=note.id and cancelled_at is null;
  select sum(amount) into wanted from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric);
  if wanted is null or wanted::text in ('NaN','Infinity','-Infinity') or wanted<=0 or wanted>note.total_ttc-used or exists(select 1 from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric) where amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<=0 or amount<>round(amount,2) or invoice_id is null) then raise exception 'CREDIT_INSUFFICIENT_AVAILABLE' using errcode='23514'; end if;
  for application in select invoice_id,sum(amount) amount from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric) group by invoice_id order by invoice_id loop
    select * into invoice from public.supplier_invoices where id=application.invoice_id and organization_id=p_organization_id and archived_at is null for update;
    if not found or invoice.supplier_id<>note.supplier_id or invoice.currency<>note.currency or invoice.status in ('draft','cancelled') then raise exception 'CREDIT_INVALID_INVOICE' using errcode='23514'; end if;
    if application.amount>invoice.remaining_amount then raise exception 'CREDIT_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
    insert into public.supplier_credit_note_applications(organization_id,credit_note_id,invoice_id,supplier_id,amount,created_by) values(p_organization_id,note.id,invoice.id,note.supplier_id,application.amount,auth.uid());
  end loop;
  perform app_private.refresh_supplier_credit_note_balances(p_organization_id,note.id);
end $$;
revoke all on function public.apply_supplier_credit_note_atomic(uuid,uuid,jsonb) from public,anon;
grant execute on function public.apply_supplier_credit_note_atomic(uuid,uuid,jsonb) to authenticated;

create or replace function public.unapply_supplier_credit_note_atomic(p_organization_id uuid,p_application_id uuid)
returns uuid language plpgsql security invoker set search_path=public,app_private
as $$
declare application public.supplier_credit_note_applications%rowtype; note_id uuid;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  select credit_note_id into note_id from public.supplier_credit_note_applications where id=p_application_id and organization_id=p_organization_id;
  if not found then raise exception 'CREDIT_APPLICATION_NOT_FOUND' using errcode='23514'; end if;
  perform 1 from public.supplier_credit_notes where id=note_id and organization_id=p_organization_id for update;
  select * into application from public.supplier_credit_note_applications where id=p_application_id and organization_id=p_organization_id for update;
  perform 1 from public.supplier_invoices where id=application.invoice_id and organization_id=p_organization_id for update;
  update public.supplier_credit_note_applications set cancelled_at=coalesce(cancelled_at,now()) where id=p_application_id and organization_id=p_organization_id;
  perform app_private.refresh_supplier_credit_note_balances(p_organization_id,note_id);
  return note_id;
end $$;
revoke all on function public.unapply_supplier_credit_note_atomic(uuid,uuid) from public,anon;
grant execute on function public.unapply_supplier_credit_note_atomic(uuid,uuid) to authenticated;


-- Supplier credits reduce the payable balance without impersonating a payment.
create or replace function public.sync_supplier_invoice_payment_totals(p_invoice_id uuid)
returns void language plpgsql security invoker set search_path=public,app_private as $$
declare invoice public.supplier_invoices%rowtype; cash numeric; credits numeric; payment_state text;
begin
 select * into invoice from public.supplier_invoices where id=p_invoice_id for update;
 if not found then return; end if;
 select coalesce(sum(a.amount),0) into cash from public.supplier_payment_allocations a join public.supplier_payments p on p.id=a.payment_id and p.organization_id=a.organization_id where a.invoice_id=p_invoice_id and a.organization_id=invoice.organization_id and a.cancelled_at is null and p.archived_at is null and p.status in('confirmed','partially_allocated','allocated');
 select coalesce(sum(a.amount),0) into credits from public.supplier_credit_note_applications a where a.invoice_id=p_invoice_id and a.organization_id=invoice.organization_id and a.cancelled_at is null;
 if cash+credits>invoice.total_ttc then raise exception 'SUPPLIER_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
 payment_state:=case when cash+credits=0 then 'unpaid' when cash+credits>=invoice.total_ttc then 'paid' else 'partial' end;
 update public.supplier_invoices set paid_amount=cash,credit_amount=credits,remaining_amount=greatest(invoice.total_ttc-cash-credits,0),payment_status=payment_state,
 status=case when invoice.status in('draft','cancelled') then invoice.status when payment_state='paid' then 'paid' when payment_state='partial' then 'partially_paid' else 'validated' end,updated_at=now() where id=p_invoice_id;
end $$;
revoke all on function public.sync_supplier_invoice_payment_totals(uuid) from public,anon;
grant execute on function public.sync_supplier_invoice_payment_totals(uuid) to authenticated;

create or replace function app_private.guard_supplier_credit_payment_limit()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare invoice public.supplier_invoices%rowtype; cash numeric; credits numeric;
begin
 if new.cancelled_at is not null then return new; end if;
 select * into invoice from public.supplier_invoices where id=new.invoice_id and organization_id=new.organization_id for update;
 if not found then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
 select coalesce(sum(a.amount),0) into credits from public.supplier_credit_note_applications a where a.invoice_id=invoice.id and a.organization_id=invoice.organization_id and a.cancelled_at is null;
 select coalesce(sum(a.amount),0) into cash from public.supplier_payment_allocations a where a.invoice_id=invoice.id and a.organization_id=invoice.organization_id and a.cancelled_at is null and a.id<>new.id;
 if cash+credits+new.amount>invoice.total_ttc then raise exception 'SUPPLIER_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function app_private.guard_supplier_credit_payment_limit() from public,anon,authenticated;
drop trigger if exists zz_supplier_credit_payment_limit_v11 on public.supplier_payment_allocations;
create trigger zz_supplier_credit_payment_limit_v11 before insert or update on public.supplier_payment_allocations for each row execute function app_private.guard_supplier_credit_payment_limit();

create or replace function app_private.guard_supplier_invoice_credit_balance()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare credits numeric;
begin
 select coalesce(sum(amount),0) into credits from public.supplier_credit_note_applications where organization_id=new.organization_id and invoice_id=new.id and cancelled_at is null;
 if new.credit_amount<>credits then raise exception 'CREDIT_BALANCES_MANAGED' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function app_private.guard_supplier_invoice_credit_balance() from public,anon,authenticated;
drop trigger if exists supplier_invoice_credit_balance_v11 on public.supplier_invoices;
create trigger supplier_invoice_credit_balance_v11 before update of credit_amount on public.supplier_invoices for each row execute function app_private.guard_supplier_invoice_credit_balance();

create or replace function app_private.guard_supplier_credit_relations()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare row_data jsonb:=to_jsonb(new); ref jsonb; refs jsonb; valid boolean;
begin
 if tg_table_name='supplier_credit_notes' then
  if tg_op='UPDATE' and auth.uid() is not null and new.credit_note_number is distinct from old.credit_note_number then raise exception 'FINANCE_DOCUMENT_NUMBER_READ_ONLY' using errcode='42501'; end if;
  if not exists(select 1 from public.third_parties where id=new.supplier_id and organization_id=new.organization_id) or (new.source_invoice_id is not null and not exists(select 1 from public.supplier_invoices where id=new.source_invoice_id and organization_id=new.organization_id and supplier_id=new.supplier_id)) then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
 else
  refs:='[{"field":"credit_note_id","table":"supplier_credit_notes"},{"field":"product_id","table":"products"},{"field":"unit_id","table":"units","global":true},{"field":"tax_rate_id","table":"tax_rates","global":true},{"field":"source_invoice_line_id","table":"supplier_invoice_lines"}]';
  for ref in select value from jsonb_array_elements(refs) loop
   if row_data->>(ref->>'field') is null then continue; end if;
   execute format('select exists(select 1 from public.%I where id=$1 and (organization_id=$2%s))',ref->>'table',case when coalesce((ref->>'global')::boolean,false) then ' or organization_id is null' else '' end) into valid using (row_data->>(ref->>'field'))::uuid,new.organization_id;
   if not valid then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
  end loop;
  if new.source_invoice_line_id is not null and not exists(select 1 from public.supplier_invoice_lines l join public.supplier_invoices i on i.id=l.invoice_id and i.organization_id=l.organization_id join public.supplier_credit_notes n on n.id=new.credit_note_id and n.organization_id=new.organization_id where l.id=new.source_invoice_line_id and i.organization_id=new.organization_id and i.supplier_id=n.supplier_id and (n.source_invoice_id is null or n.source_invoice_id=i.id)) then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_supplier_credit_relations() from public,anon,authenticated;
drop trigger if exists essential_supplier_credit_relations_v11 on public.supplier_credit_notes;
create trigger essential_supplier_credit_relations_v11 before insert or update on public.supplier_credit_notes for each row execute function app_private.guard_supplier_credit_relations();
drop trigger if exists essential_supplier_credit_relations_v11 on public.supplier_credit_note_lines;
create trigger essential_supplier_credit_relations_v11 before insert or update on public.supplier_credit_note_lines for each row execute function app_private.guard_supplier_credit_relations();

commit;
select to_regprocedure('public.save_supplier_credit_note_atomic(uuid,uuid,jsonb,jsonb)') is not null
 and to_regprocedure('public.apply_supplier_credit_note_atomic(uuid,uuid,jsonb)') is not null
 and to_regprocedure('public.unapply_supplier_credit_note_atomic(uuid,uuid)') is not null
 and exists(select 1 from pg_trigger where tgname='supplier_credit_note_number_v11')
 and exists(select 1 from pg_policies where tablename='supplier_credit_note_applications' and policyname='essential_supplier_credit_write_insert_v11') as avoirs_fournisseurs_101_actifs;
