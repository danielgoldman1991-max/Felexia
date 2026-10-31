-- Felexia Pro Essentiel: migrations 098 to 101, validated release.
-- Execute this complete file in the Felexia Supabase SQL Editor.
-- One transaction: an error rolls back the complete batch. Existing document
-- numbers, amounts, memberships and account currencies are not rewritten.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '180s';

-- 098_essential_finance_integrity.sql
-- SHA256 526cd8a8832d2f9ba45b47ef9eba17c7ffae1ffdc9ae5d35d2b6a5a8eaca9b0e
-- Essential financial integrity. Additive, transactional; no historical amount,
-- document number, account currency or membership is rewritten.


create or replace function app_private.guard_essential_finance_relations()
returns trigger language plpgsql security definer
set search_path = public, app_private
as $$
declare
  row_data jsonb := to_jsonb(new);
  previous jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  refs jsonb;
  ref jsonb;
  field_name text;
  target_name text;
  target_id uuid;
  valid boolean;
begin
  refs := case tg_table_name
    when 'customer_invoices' then '[{"field":"customer_id","table":"third_parties"},{"field":"source_order_id","table":"sales_documents"},{"field":"source_delivery_id","table":"sales_documents"},{"field":"source_document_id","table":"sales_documents"}]'
    when 'supplier_invoices' then '[{"field":"supplier_id","table":"third_parties"},{"field":"source_receipt_id","table":"purchase_documents"}]'
    when 'customer_invoice_lines' then '[{"field":"invoice_id","table":"customer_invoices"},{"field":"product_id","table":"products"},{"field":"unit_id","table":"units"},{"field":"tax_rate_id","table":"tax_rates","global":true},{"field":"source_line_id","table":"sales_document_lines"},{"field":"source_document_id","table":"sales_documents"}]'
    when 'supplier_invoice_lines' then '[{"field":"invoice_id","table":"supplier_invoices"},{"field":"product_id","table":"products"},{"field":"unit_id","table":"units"},{"field":"tax_rate_id","table":"tax_rates","global":true},{"field":"source_line_id","table":"purchase_document_lines"},{"field":"source_document_id","table":"purchase_documents"}]'
    when 'customer_payments' then '[{"field":"customer_id","table":"third_parties"},{"field":"treasury_account_id","table":"treasury_accounts"}]'
    when 'supplier_payments' then '[{"field":"supplier_id","table":"third_parties"},{"field":"treasury_account_id","table":"treasury_accounts"}]'
    when 'customer_payment_allocations' then '[{"field":"invoice_id","table":"customer_invoices"},{"field":"payment_id","table":"customer_payments"}]'
    when 'supplier_payment_allocations' then '[{"field":"invoice_id","table":"supplier_invoices"},{"field":"payment_id","table":"supplier_payments"}]'
    when 'third_party_contacts' then '[{"field":"third_party_id","table":"third_parties"}]'
    when 'third_party_addresses' then '[{"field":"third_party_id","table":"third_parties"}]'
    when 'accounting_entries' then '[{"field":"journal_id","table":"accounting_journals"}]'
    when 'accounting_entry_lines' then '[{"field":"entry_id","table":"accounting_entries"},{"field":"account_id","table":"accounting_accounts"}]'
    else '[]' end;
  for ref in select value from jsonb_array_elements(refs) loop
    field_name := ref->>'field'; target_name := ref->>'table';
    if row_data->>field_name is null then continue; end if;
    if tg_op = 'UPDATE' and row_data->field_name is not distinct from previous->field_name
      and new.organization_id is not distinct from old.organization_id then continue; end if;
    target_id := (row_data->>field_name)::uuid;
    execute format('select exists(select 1 from public.%I where id=$1 and (organization_id=$2%s))',
      target_name, case when coalesce((ref->>'global')::boolean,false) then ' or organization_id is null' else '' end)
      into valid using target_id, new.organization_id;
    if not valid then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function app_private.guard_essential_finance_relations() from public, anon, authenticated;

do $$
declare target text;
begin
  foreach target in array array['customer_invoices','customer_invoice_lines','supplier_invoices','supplier_invoice_lines',
    'customer_payments','supplier_payments','customer_payment_allocations','supplier_payment_allocations',
    'third_party_contacts','third_party_addresses','accounting_entries','accounting_entry_lines'] loop
    execute format('drop trigger if exists essential_finance_relations_v8 on public.%I',target);
    execute format('create trigger essential_finance_relations_v8 before insert or update on public.%I for each row execute function app_private.guard_essential_finance_relations()',target);
  end loop;
  foreach target in array array['third_party_contacts','third_party_addresses'] loop
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||target)) then
      raise exception 'RLS_DISABLED_REQUIRES_REVIEW: %',target;
    end if;
    execute format('drop policy if exists essential_readonly_insert_v8 on public.%I',target);
    execute format('drop policy if exists essential_readonly_update_v8 on public.%I',target);
    execute format('drop policy if exists essential_readonly_delete_v8 on public.%I',target);
    execute format('create policy essential_readonly_insert_v8 on public.%I as restrictive for insert to authenticated with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_readonly_update_v8 on public.%I as restrictive for update to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)) with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_readonly_delete_v8 on public.%I as restrictive for delete to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
  end loop;
end;
$$;

create or replace function app_private.guard_essential_currency()
returns trigger language plpgsql security definer
set search_path=public,app_private
as $$
declare data jsonb:=to_jsonb(new); previous jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end; account_currency text;
begin
  -- Historical foreign-currency rows stay readable. Metadata/allocation updates
  -- can preserve them; new monetary facts cannot silently mix their units.
  if tg_op='UPDATE' and tg_table_name='treasury_accounts' and data->'currency' is distinct from previous->'currency' then
    raise exception 'FINANCE_ACCOUNT_CURRENCY_READ_ONLY' using errcode='42501';
  end if;
  if tg_op='UPDATE' and tg_table_name='treasury_accounts'
    and data->'currency' is not distinct from previous->'currency'
    and data->'opening_balance' is not distinct from previous->'opening_balance'
    and data->'current_balance' is not distinct from previous->'current_balance' then return new; end if;
  if tg_op='UPDATE' and (data - array['updated_at','notes','internal_notes','status','archived_at','is_default','allocated_amount','available_amount','reference','bank_name','check_number','transfer_reference','due_date'])
      is not distinct from (previous - array['updated_at','notes','internal_notes','status','archived_at','is_default','allocated_amount','available_amount','reference','bank_name','check_number','transfer_reference','due_date']) then return new; end if;
  if upper(coalesce(data->>'currency','MAD')) <> 'MAD' then
    raise exception 'FINANCE_MAD_ONLY' using errcode='23514';
  end if;
  if tg_table_name in ('customer_payments','supplier_payments','treasury_transactions') and data->>'treasury_account_id' is not null then
    select currency into account_currency from public.treasury_accounts where id=(data->>'treasury_account_id')::uuid and organization_id=new.organization_id;
    if account_currency is null or upper(account_currency)<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_essential_currency() from public,anon,authenticated;
do $$ declare target text; begin
  foreach target in array array['treasury_accounts','customer_payments','supplier_payments','treasury_transactions'] loop
    execute format('drop trigger if exists essential_currency_v8 on public.%I',target);
    execute format('create trigger essential_currency_v8 before insert or update on public.%I for each row execute function app_private.guard_essential_currency()',target);
  end loop;
end; $$;

create or replace function app_private.guard_essential_posted_payment()
returns trigger language plpgsql security definer
set search_path=public,app_private
as $$
declare source_kind text:=case when tg_table_name='customer_payments' then 'customer_payment' else 'supplier_payment' end;
begin
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text||':'||source_kind||':'||old.id::text,0));
  if exists(select 1 from public.accounting_entries where organization_id=old.organization_id and source_document_type=source_kind and source_document_id=old.id and status='posted') then
    if tg_op='DELETE' then raise exception 'FINANCE_POSTED_PAYMENT_READ_ONLY' using errcode='42501'; end if;
    if new.status not in ('confirmed','partially_allocated','allocated')
      or (to_jsonb(new)-array['allocated_amount','available_amount','status','updated_at','notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date'])
        is distinct from (to_jsonb(old)-array['allocated_amount','available_amount','status','updated_at','notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date']) then
      raise exception 'FINANCE_POSTED_PAYMENT_READ_ONLY' using errcode='42501';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function app_private.guard_essential_posted_payment() from public,anon,authenticated;
drop trigger if exists essential_posted_payment_v8 on public.customer_payments;
create trigger essential_posted_payment_v8 before update or delete on public.customer_payments for each row execute function app_private.guard_essential_posted_payment();
drop trigger if exists essential_posted_payment_v8 on public.supplier_payments;
create trigger essential_posted_payment_v8 before update or delete on public.supplier_payments for each row execute function app_private.guard_essential_posted_payment();

create or replace function app_private.guard_essential_invoice_change()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare source_kind text:=case when tg_table_name='customer_invoices' then 'customer_invoice' else 'supplier_invoice' end; data jsonb; previous jsonb:=to_jsonb(old); posted boolean; totals record;
begin
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'FINANCE_DRAFT_REQUIRED' using errcode='42501'; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text||':'||source_kind||':'||old.id::text,0));
  select exists(select 1 from public.accounting_entries where organization_id=old.organization_id and source_document_type=source_kind and source_document_id=old.id and status='posted') into posted;
  if tg_op='DELETE' then
    if old.status<>'draft' or coalesce(old.paid_amount,0)>0 or posted then raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode='42501'; end if;
    return old;
  end if;
  data:=to_jsonb(new);
  if (old.status<>'draft' and new.status='draft') or (old.status='cancelled' and new.status<>'cancelled') then raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode='42501'; end if;
  if old.status='draft' and new.status not in ('draft','cancelled') then
    execute format('select count(*) n,coalesce(sum(subtotal_ht),0) ht,coalesce(sum(discount_amount),0) discount,coalesce(sum(tax_amount),0) vat,coalesce(sum(total_ttc),0) ttc from public.%I where invoice_id=$1 and organization_id=$2',case when tg_table_name='customer_invoices' then 'customer_invoice_lines' else 'supplier_invoice_lines' end) into totals using old.id,old.organization_id;
    if totals.n=0 or totals.ttc<=0 or (new.subtotal_ht,new.discount_total,new.tax_total,new.total_ttc) is distinct from (totals.ht,totals.discount,totals.vat,totals.ttc) then raise exception 'FINANCE_INVALID_DOCUMENT' using errcode='23514'; end if;
  end if;
  if auth.uid() is not null and new.invoice_number is distinct from old.invoice_number then raise exception 'FINANCE_DOCUMENT_NUMBER_READ_ONLY' using errcode='42501'; end if;
  if (posted or coalesce(old.paid_amount,0)>0 or coalesce((previous->>'credit_amount')::numeric,0)>0)
    and (new.status='cancelled' or new.archived_at is distinct from old.archived_at) then raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode='42501'; end if;
  if old.status<>'draft' and (data-array['status','payment_status','paid_amount','remaining_amount','credit_amount','notes','internal_notes','sent_at','cancelled_at','updated_at','archived_at'])
    is distinct from (previous-array['status','payment_status','paid_amount','remaining_amount','credit_amount','notes','internal_notes','sent_at','cancelled_at','updated_at','archived_at']) then raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode='42501'; end if;
  return new;
end; $$;
revoke all on function app_private.guard_essential_invoice_change() from public,anon,authenticated;
drop trigger if exists essential_invoice_change_v8 on public.customer_invoices;
create trigger essential_invoice_change_v8 before insert or update or delete on public.customer_invoices for each row execute function app_private.guard_essential_invoice_change();
drop trigger if exists essential_invoice_change_v8 on public.supplier_invoices;
create trigger essential_invoice_change_v8 before insert or update or delete on public.supplier_invoices for each row execute function app_private.guard_essential_invoice_change();

create or replace function app_private.guard_essential_invoice_lines()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare parent_table text:=case when tg_table_name='customer_invoice_lines' then 'customer_invoices' else 'supplier_invoices' end; parent_status text; data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; gross numeric; net numeric;
begin
  if tg_op='UPDATE' and (new.organization_id is distinct from old.organization_id or new.invoice_id is distinct from old.invoice_id) then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
  execute format('select status from public.%I where id=$1 and organization_id=$2 for update',parent_table) into parent_status using (data->>'invoice_id')::uuid,(data->>'organization_id')::uuid;
  if parent_status is distinct from 'draft' then raise exception 'FINANCE_DRAFT_REQUIRED' using errcode='42501'; end if;
  if tg_op<>'DELETE' then
    if new.quantity is null or new.unit_price_ht is null or new.quantity::text in ('NaN','Infinity','-Infinity') or new.unit_price_ht::text in ('NaN','Infinity','-Infinity') or new.discount_rate::text in ('NaN','Infinity','-Infinity') or new.tax_rate::text in ('NaN','Infinity','-Infinity') or new.quantity<=0 or new.unit_price_ht<0 or new.discount_rate not between 0 and 100 or new.tax_rate not between 0 and 100 or nullif(btrim(new.description),'') is null then raise exception 'FINANCE_INVALID_LINE' using errcode='23514'; end if;
    gross:=round(new.quantity*new.unit_price_ht,2); new.discount_amount:=round(gross*new.discount_rate/100,2); net:=gross-new.discount_amount;
    new.subtotal_ht:=case when tg_table_name='supplier_invoice_lines' then gross else net end; new.tax_amount:=round(net*new.tax_rate/100,2); new.total_ttc:=net+new.tax_amount;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function app_private.guard_essential_invoice_lines() from public,anon,authenticated;
drop trigger if exists essential_invoice_lines_v8 on public.customer_invoice_lines;
create trigger essential_invoice_lines_v8 before insert or update or delete on public.customer_invoice_lines for each row execute function app_private.guard_essential_invoice_lines();
drop trigger if exists essential_invoice_lines_v8 on public.supplier_invoice_lines;
create trigger essential_invoice_lines_v8 before insert or update or delete on public.supplier_invoice_lines for each row execute function app_private.guard_essential_invoice_lines();

-- Header and lines use one transaction. SQL totals are authoritative and a
-- failed line replacement restores the original header and all original lines.
create or replace function app_private.save_essential_invoice(
  p_kind text,p_organization_id uuid,p_invoice_id uuid,p_header jsonb,p_lines jsonb
)
returns uuid language plpgsql security invoker
set search_path=public,app_private
as $$
declare
  target text; lines_table text; allowed text[]; line_allowed text[];
  header jsonb; line jsonb; cleaned jsonb; normalized jsonb:='[]'::jsonb;
  result_id uuid; current_status text; current_paid numeric; columns_sql text; values_sql text; update_sql text;
  quantity numeric; price numeric; discount numeric; rate numeric; gross numeric; net numeric;
  subtotal numeric:=0; discounts numeric:=0; tax numeric:=0; total numeric:=0; i integer:=0;
  duplicate_id uuid; v_supplier_id uuid; supplier_number text;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then
    raise exception 'FINANCE_WRITE_REQUIRED' using errcode='42501';
  end if;
  if p_kind not in ('customer','supplier') or jsonb_typeof(p_header) is distinct from 'object' or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500 then
    raise exception 'FINANCE_INVALID_DOCUMENT' using errcode='22023';
  end if;
  target:=p_kind||'_invoices'; lines_table:=p_kind||'_invoice_lines';
  if p_invoice_id is not null then
    execute format('select id,status,paid_amount from public.%I where id=$1 and organization_id=$2 for update',target) into result_id,current_status,current_paid using p_invoice_id,p_organization_id;
    if result_id is null or current_status<>'draft' or coalesce(current_paid,0)<>0 then raise exception 'FINANCE_DRAFT_REQUIRED' using errcode='23514'; end if;
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(line) is distinct from 'object' or nullif(btrim(line->>'description'),'') is null then raise exception 'FINANCE_INVALID_LINE' using errcode='22023'; end if;
    quantity:=round((line->>'quantity')::numeric,3); price:=round((line->>'unit_price_ht')::numeric,2); discount:=round(coalesce((line->>'discount_rate')::numeric,0),2); rate:=round(coalesce((line->>'tax_rate')::numeric,0),2);
    if quantity is null or quantity<=0 or quantity::text in ('NaN','Infinity','-Infinity') or price is null or price<0 or price::text in ('NaN','Infinity','-Infinity') or discount not between 0 and 100 or rate not between 0 and 100 then raise exception 'FINANCE_INVALID_LINE' using errcode='22023'; end if;
    gross:=round(quantity*price,2); net:=gross-round(gross*discount/100,2); i:=i+1;
    -- Existing purchase lines store gross HT, with discount_amount separately;
    -- customer lines store net HT. Preserve both contracts for journal builders.
    cleaned:=line || jsonb_build_object('organization_id',p_organization_id,'line_order',i,'quantity',quantity,'unit_price_ht',price,'discount_rate',discount,'tax_rate',rate,'subtotal_ht',round(case when p_kind='supplier' then gross else net end,2),'discount_amount',round(gross*discount/100,2),'tax_amount',round(net*rate/100,2),'total_ttc',net+round(net*rate/100,2));
    subtotal:=subtotal+round(case when p_kind='supplier' then gross else net end,2); discounts:=discounts+round(gross*discount/100,2); tax:=tax+round(net*rate/100,2); total:=total+net+round(net*rate/100,2);
    normalized:=normalized||jsonb_build_array(cleaned);
  end loop;
  header:=p_header||jsonb_build_object('organization_id',p_organization_id,'subtotal_ht',subtotal,'discount_total',discounts,'tax_total',tax,'total_ttc',total,'paid_amount',0,'remaining_amount',total,'payment_status','unpaid');
  allowed:=array['organization_id','customer_id','supplier_id','supplier_invoice_number','invoice_date','due_date','source_type','source_document_id','source_order_id','source_delivery_id','source_receipt_id','payment_terms_days','payment_terms','payment_method','custom_payment_terms','custom_payment_method','subtotal_ht','discount_total','tax_total','total_ttc','paid_amount','remaining_amount','payment_status','notes','internal_notes'];
  if p_kind='supplier' then
    v_supplier_id:=(header->>'supplier_id')::uuid; supplier_number:=nullif(btrim(header->>'supplier_invoice_number'),'');
    if v_supplier_id is null or supplier_number is null then raise exception 'FINANCE_SUPPLIER_REFERENCE_REQUIRED' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':supplier-reference:'||v_supplier_id::text||':'||supplier_number,0));
    select id into duplicate_id from public.supplier_invoices where organization_id=p_organization_id and supplier_id=v_supplier_id and supplier_invoice_number=supplier_number and status<>'cancelled' and (p_invoice_id is null or id<>p_invoice_id) limit 1;
    if duplicate_id is not null then raise exception 'FINANCE_SUPPLIER_REFERENCE_EXISTS' using errcode='23505'; end if;
  end if;
  if result_id is null then
    header:=header||jsonb_build_object('invoice_number','','status','draft','created_by',auth.uid());
    allowed:=allowed||array['invoice_number','status','created_by'];
  end if;
  select string_agg(format('%I',key),',' order by key),string_agg(format('x.%I',key),',' order by key),string_agg(format('%1$I=x.%1$I',key),',' order by key)
    into columns_sql,values_sql,update_sql from jsonb_object_keys(header) key
    where key=any(allowed) and exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||target) and attname=key and not attisdropped);
  if result_id is null then
    execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) x returning id',target,columns_sql,values_sql,target) into result_id using header;
  else
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) x where t.id=$2 and t.organization_id=$3',target,update_sql,target) using header,result_id,p_organization_id;
    execute format('delete from public.%I where invoice_id=$1 and organization_id=$2',lines_table) using result_id,p_organization_id;
  end if;
  line_allowed:=array['organization_id','invoice_id','line_order','source_line_id','source_document_id','product_id','product_name','description','quantity','unit_id','unit_name','unit_price_ht','discount_rate','tax_rate_id','tax_rate','subtotal_ht','discount_amount','tax_amount','total_ttc'];
  for line in select value||jsonb_build_object('invoice_id',result_id) from jsonb_array_elements(normalized) loop
    select string_agg(format('%I',key),',' order by key),string_agg(format('x.%I',key),',' order by key) into columns_sql,values_sql from jsonb_object_keys(line) key
      where key=any(line_allowed) and exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||lines_table) and attname=key and not attisdropped);
    execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) x',lines_table,columns_sql,values_sql,lines_table) using line;
  end loop;
  return result_id;
end;
$$;
revoke all on function app_private.save_essential_invoice(text,uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function app_private.save_essential_invoice(text,uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function public.save_customer_invoice_atomic(p_organization_id uuid,p_invoice_id uuid,p_header jsonb,p_lines jsonb)
returns uuid language sql security invoker set search_path=public,app_private
as $$ select app_private.save_essential_invoice('customer',p_organization_id,p_invoice_id,p_header,p_lines); $$;
create or replace function public.save_supplier_invoice_atomic(p_organization_id uuid,p_invoice_id uuid,p_header jsonb,p_lines jsonb)
returns uuid language sql security invoker set search_path=public,app_private
as $$ select app_private.save_essential_invoice('supplier',p_organization_id,p_invoice_id,p_header,p_lines); $$;
revoke all on function public.save_customer_invoice_atomic(uuid,uuid,jsonb,jsonb),public.save_supplier_invoice_atomic(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_customer_invoice_atomic(uuid,uuid,jsonb,jsonb),public.save_supplier_invoice_atomic(uuid,uuid,jsonb,jsonb) to authenticated;

-- Concurrent posting shares this lock with payment cancellation. Existing
-- duplicate sources are never deleted automatically: installation stops safely.
do $$ begin
  if exists(select 1 from public.accounting_entries where source_document_type is not null and source_document_id is not null and status<>'cancelled' group by organization_id,source_document_type,source_document_id having count(*)>1) then
    raise exception 'ACCOUNTING_DUPLICATE_SOURCES_REQUIRE_REVIEW';
  end if;
end; $$;
create unique index if not exists accounting_entries_active_source_unique_v8 on public.accounting_entries(organization_id,source_document_type,source_document_id)
  where source_document_type is not null and source_document_id is not null and status<>'cancelled';

create or replace function app_private.finance_source_definition(p_kind text)
returns jsonb language sql immutable security invoker set search_path=public,app_private
as $$ select case p_kind
  when 'customer_invoice' then '{"table":"customer_invoices","amount":"total_ttc"}'::jsonb
  when 'supplier_invoice' then '{"table":"supplier_invoices","amount":"total_ttc"}'::jsonb
  when 'customer_payment' then '{"table":"customer_payments","amount":"amount"}'::jsonb
  when 'supplier_payment' then '{"table":"supplier_payments","amount":"amount"}'::jsonb
  when 'customer_credit_note' then '{"table":"customer_credit_notes","amount":"total_ttc"}'::jsonb
  else null end; $$;
revoke all on function app_private.finance_source_definition(text) from public,anon;
grant execute on function app_private.finance_source_definition(text) to authenticated;

create or replace function app_private.guard_essential_accounting_source()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare target text; valid boolean;
begin
  if new.source_document_id is null then return new; end if;
  target:=app_private.finance_source_definition(new.source_document_type)->>'table';
  if target is null then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||':'||new.source_document_type||':'||new.source_document_id::text,0));
  execute format('select exists(select 1 from public.%I where id=$1 and organization_id=$2 and status not in (''draft'',''cancelled'') and archived_at is null)',target) into valid using new.source_document_id,new.organization_id;
  if not valid then raise exception 'FINANCE_SOURCE_NOT_POSTABLE' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function app_private.guard_essential_accounting_source() from public,anon,authenticated;
drop trigger if exists essential_accounting_source_v8 on public.accounting_entries;
create trigger essential_accounting_source_v8 before insert or update of organization_id,source_document_type,source_document_id on public.accounting_entries for each row execute function app_private.guard_essential_accounting_source();

create or replace function app_private.guard_essential_posted_entry()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; parent_status text;
begin
  if tg_table_name='accounting_entries' then
    if old.status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['label','reference','notes','updated_at']) is distinct from (to_jsonb(old)-array['label','reference','notes','updated_at']) then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
    end if;
  else
    select status into parent_status from public.accounting_entries where id=(to_jsonb(old)->>'entry_id')::uuid;
    if parent_status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status'])
        is distinct from (to_jsonb(old)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status']) then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function app_private.guard_essential_posted_entry() from public,anon,authenticated;
drop trigger if exists essential_posted_entry_v8 on public.accounting_entries;
create trigger essential_posted_entry_v8 before update or delete on public.accounting_entries for each row execute function app_private.guard_essential_posted_entry();
drop trigger if exists essential_posted_entry_line_v8 on public.accounting_entry_lines;
create trigger essential_posted_entry_line_v8 before update or delete on public.accounting_entry_lines for each row execute function app_private.guard_essential_posted_entry();

-- A POSTed entry and its lines must be committed together, even for direct
-- PostgREST calls. Deferred checking lets the atomic RPC insert its header first.
create or replace function app_private.verify_essential_posted_entry()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare document_id uuid; entry record; balance record; data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; source_definition jsonb; expected_amount numeric; expected_currency text;
begin
  document_id:=(data->>(case when tg_table_name='accounting_entries' then 'id' else 'entry_id' end))::uuid;
  select * into entry from public.accounting_entries where id=document_id;
  if not found or entry.status<>'posted' then return null; end if;
  select count(*) n,coalesce(sum(debit),0) debit,coalesce(sum(credit),0) credit,
    bool_and(organization_id=entry.organization_id and debit>=0 and credit>=0 and ((debit>0)<>(credit>0))) valid
    into balance from public.accounting_entry_lines where entry_id=document_id;
  if balance.n<2 or not coalesce(balance.valid,false) or balance.debit<=0 or balance.debit<>balance.credit
    or balance.debit<>entry.total_debit or balance.credit<>entry.total_credit then raise exception 'FINANCE_ENTRY_UNBALANCED' using errcode='23514'; end if;
  if entry.source_document_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(entry.organization_id::text||':'||entry.source_document_type||':'||entry.source_document_id::text,0));
    source_definition:=app_private.finance_source_definition(entry.source_document_type);
    if source_definition is null then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
    execute format('select %I,currency from public.%I where id=$1 and organization_id=$2 and status not in (''draft'',''cancelled'') and archived_at is null',source_definition->>'amount',source_definition->>'table') into expected_amount,expected_currency using entry.source_document_id,entry.organization_id;
    if expected_amount is null then raise exception 'FINANCE_SOURCE_NOT_POSTABLE' using errcode='23514'; end if;
    if expected_currency<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
    if balance.debit<>round(expected_amount,2) then raise exception 'FINANCE_SOURCE_AMOUNT_MISMATCH' using errcode='23514'; end if;
  end if;
  return null;
end; $$;
revoke all on function app_private.verify_essential_posted_entry() from public,anon,authenticated;
drop trigger if exists essential_balanced_entry_v8 on public.accounting_entries;
create constraint trigger essential_balanced_entry_v8 after insert or update on public.accounting_entries deferrable initially deferred for each row execute function app_private.verify_essential_posted_entry();
drop trigger if exists essential_balanced_entry_lines_v8 on public.accounting_entry_lines;
create constraint trigger essential_balanced_entry_lines_v8 after insert or update or delete on public.accounting_entry_lines deferrable initially deferred for each row execute function app_private.verify_essential_posted_entry();

create or replace function public.save_accounting_entry_atomic(p_organization_id uuid,p_entry_id uuid,p_header jsonb,p_lines jsonb)
returns table(entry_id uuid,entry_number text) language plpgsql security invoker
set search_path=public,app_private
as $$
declare
  result_id uuid; result_number text; header jsonb; line jsonb; cleaned jsonb; account record;
  debit numeric:=0; credit numeric:=0; source_kind text; source_id uuid; source_definition jsonb; expected_amount numeric; expected_currency text;
  columns_sql text; values_sql text; allowed text[]; i integer:=0;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) or app_private.is_operator_org_member(p_organization_id) then raise exception 'FINANCE_ACCOUNTING_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_entry_id is not null or jsonb_typeof(p_header) is distinct from 'object' or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 2 and 1000 then raise exception 'FINANCE_INVALID_ENTRY' using errcode='22023'; end if;
  source_kind:=nullif(p_header->>'source_document_type',''); source_id:=nullif(p_header->>'source_document_id','')::uuid;
  if (source_kind is null)<>(source_id is null) then raise exception 'FINANCE_INVALID_ENTRY' using errcode='22023'; end if;
  if source_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||source_kind||':'||source_id::text,0));
    select id,e.entry_number into result_id,result_number from public.accounting_entries e where organization_id=p_organization_id and source_document_type=source_kind and source_document_id=source_id and status<>'cancelled' limit 1;
    if result_id is not null then return query select result_id,result_number; return; end if;
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(line->>'debit','0') in ('NaN','Infinity','-Infinity') or coalesce(line->>'credit','0') in ('NaN','Infinity','-Infinity')
      or coalesce((line->>'debit')::numeric,0)<0 or coalesce((line->>'credit')::numeric,0)<0
      or (coalesce((line->>'debit')::numeric,0)>0)=(coalesce((line->>'credit')::numeric,0)>0) then raise exception 'FINANCE_INVALID_ENTRY_LINE' using errcode='22023'; end if;
    debit:=debit+round(coalesce((line->>'debit')::numeric,0),2); credit:=credit+round(coalesce((line->>'credit')::numeric,0),2);
  end loop;
  if debit<>credit or debit<=0 then raise exception 'FINANCE_ENTRY_UNBALANCED' using errcode='23514'; end if;
  if source_id is not null then
    source_definition:=app_private.finance_source_definition(source_kind);
    if source_definition is null then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
    execute format('select %I,currency from public.%I where id=$1 and organization_id=$2 and status not in (''draft'',''cancelled'') and archived_at is null',source_definition->>'amount',source_definition->>'table') into expected_amount,expected_currency using source_id,p_organization_id;
    if expected_amount is null then raise exception 'FINANCE_SOURCE_NOT_POSTABLE' using errcode='23514'; end if;
    if expected_currency<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
    if debit<>round(expected_amount,2) then raise exception 'FINANCE_SOURCE_AMOUNT_MISMATCH' using errcode='23514'; end if;
  end if;
  header:=p_header||jsonb_build_object('organization_id',p_organization_id,'entry_number',null,'total_debit',debit,'total_credit',credit,'created_by',auth.uid(),'status',case when p_header->>'status'='posted' then 'posted' else 'draft' end);
  if header->>'status'='posted' then header:=header||jsonb_build_object('posted_at',now(),'posted_by',auth.uid()); end if;
  allowed:=array['organization_id','entry_number','journal_id','entry_date','reference','label','notes','status','total_debit','total_credit','created_by','posted_at','posted_by','source_module','source_document_type','source_document_id','source_number'];
  select string_agg(format('%I',key),',' order by key),string_agg(format('x.%I',key),',' order by key) into columns_sql,values_sql from jsonb_object_keys(header) key
    where key=any(allowed) and exists(select 1 from pg_attribute where attrelid='public.accounting_entries'::regclass and attname=key and not attisdropped);
  execute format('insert into public.accounting_entries(%s) select %s from jsonb_populate_record(null::public.accounting_entries,$1) x returning id,entry_number',columns_sql,values_sql) into result_id,result_number using header;
  for line in select value from jsonb_array_elements(p_lines) loop
    select id,code,name into account from public.accounting_accounts where id=(line->>'account_id')::uuid and organization_id=p_organization_id;
    if not found then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
    i:=i+1; cleaned:=line||jsonb_build_object('organization_id',p_organization_id,'entry_id',result_id,'line_number',i,'account_code',account.code,'account_label',account.name,'debit',round(coalesce((line->>'debit')::numeric,0),2),'credit',round(coalesce((line->>'credit')::numeric,0),2));
    allowed:=array['organization_id','entry_id','line_number','account_id','account_code','account_label','debit','credit','label','due_date','auxiliary_id'];
    select string_agg(format('%I',key),',' order by key),string_agg(format('x.%I',key),',' order by key) into columns_sql,values_sql from jsonb_object_keys(cleaned) key
      where key=any(allowed) and exists(select 1 from pg_attribute where attrelid='public.accounting_entry_lines'::regclass and attname=key and not attisdropped);
    execute format('insert into public.accounting_entry_lines(%s) select %s from jsonb_populate_record(null::public.accounting_entry_lines,$1) x',columns_sql,values_sql) using cleaned;
  end loop;
  return query select result_id,result_number;
end; $$;
revoke all on function public.save_accounting_entry_atomic(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_accounting_entry_atomic(uuid,uuid,jsonb,jsonb) to authenticated;

-- 099_essential_subscription_access.sql
-- SHA256 6871dc1e5105aedc9cf67d35e960789a9cc5d6145bc6ac2a11b2169bdaafcd07
-- Felexia Pro: server-owned billing, one-time trial, write entitlements and
-- concurrency-safe monthly commercial-document usage. Apply after 098.
-- Existing plans, dates, documents and commercial amounts are not rewritten.


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

-- 100_essential_credit_note_corrections.sql
-- SHA256 055de20ddff830ce9e1981f0f85f6cbeba1e1e810fd482f9f0562f475346c199
-- Essential credit-note correction workflows. No existing document is rewritten.


do $$
declare target text;
begin
  foreach target in array array['customer_credit_notes','customer_credit_note_lines','customer_credit_note_applications'] loop
    execute format('drop policy if exists essential_credit_write_insert_v10 on public.%I',target);
    execute format('drop policy if exists essential_credit_write_update_v10 on public.%I',target);
    execute format('drop policy if exists essential_credit_write_delete_v10 on public.%I',target);
    execute format('create policy essential_credit_write_insert_v10 on public.%I as restrictive for insert to authenticated with check(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_credit_write_update_v10 on public.%I as restrictive for update to authenticated using(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)) with check(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))',target);
    execute format('create policy essential_credit_write_delete_v10 on public.%I as restrictive for delete to authenticated using(app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id)%s)',target,case when target='customer_credit_note_applications' then ' and false' when target='customer_credit_notes' then ' and status=''draft''' else '' end);
  end loop;
end $$;

create or replace function app_private.guard_essential_credit_note()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare note public.customer_credit_notes%rowtype; row_data jsonb; used numeric; invoice_total numeric; invoice_paid numeric; invoice_used numeric; line_totals record; gross numeric;
begin
  if auth.uid() is not null and (not app_private.has_active_org_membership(case when tg_op='DELETE' then old.organization_id else new.organization_id end) or app_private.is_read_only_org_member(case when tg_op='DELETE' then old.organization_id else new.organization_id end)) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if tg_table_name='customer_credit_notes' then
    if tg_op<>'DELETE' and (new.total_ttc::text in ('NaN','Infinity','-Infinity') or new.subtotal_ht::text in ('NaN','Infinity','-Infinity') or new.tax_total::text in ('NaN','Infinity','-Infinity')) then raise exception 'CREDIT_INVALID_TOTAL' using errcode='23514'; end if;
    if tg_op='INSERT' and new.currency<>'MAD' then raise exception 'FINANCE_MAD_ONLY' using errcode='23514'; end if;
    if tg_op='INSERT' and new.status<>'draft' then raise exception 'CREDIT_DRAFT_REQUIRED' using errcode='23514'; end if;
    if tg_op='INSERT' or (tg_op='UPDATE' and old.status='draft') then
      if not exists(select 1 from public.third_parties where id=new.customer_id and organization_id=new.organization_id and archived_at is null and status='active' and ('customer'=any(types) or primary_type='customer')) then raise exception 'CREDIT_INVALID_CUSTOMER' using errcode='23514'; end if;
      if new.source_invoice_id is not null and not exists(select 1 from public.customer_invoices where id=new.source_invoice_id and organization_id=new.organization_id and customer_id=new.customer_id and status not in ('draft','cancelled') and archived_at is null and currency=new.currency) then raise exception 'CREDIT_INVALID_SOURCE' using errcode='23514'; end if;
      if new.source_return_id is not null and not exists(select 1 from public.sales_documents where id=new.source_return_id and organization_id=new.organization_id and customer_id=new.customer_id and document_type='return_note' and status='validated' and archived_at is null) then raise exception 'CREDIT_INVALID_SOURCE' using errcode='23514'; end if;
    end if;
    if tg_op='UPDATE' then
      if (old.status<>'draft' and new.status='draft') or (old.status='cancelled' and new.status<>'cancelled') then raise exception 'CREDIT_NOTE_VALIDATED_READ_ONLY' using errcode='42501'; end if;
      if old.status<>'draft' and (to_jsonb(new)-array['applied_amount','available_amount','status','updated_at','notes','internal_notes','cancelled_at']) is distinct from (to_jsonb(old)-array['applied_amount','available_amount','status','updated_at','notes','internal_notes','cancelled_at']) then raise exception 'CREDIT_NOTE_VALIDATED_READ_ONLY' using errcode='42501'; end if;
      select coalesce(sum(amount),0) into used from public.customer_credit_note_applications where organization_id=new.organization_id and credit_note_id=new.id and cancelled_at is null;
      if new.applied_amount<>used or new.available_amount<>(case when new.status in ('draft','cancelled') then 0 else greatest(new.total_ttc-used,0) end) then raise exception 'CREDIT_BALANCES_MANAGED' using errcode='23514'; end if;
      if new.status='cancelled' and used<>0 then raise exception 'CREDIT_HAS_APPLICATIONS' using errcode='23514'; end if;
      if old.status='draft' and new.status<>'draft' and new.status<>'cancelled' then
        select count(*) n,coalesce(sum(subtotal_ht),0) ht,coalesce(sum(discount_amount),0) discount,coalesce(sum(tax_amount),0) vat,coalesce(sum(total_ttc),0) ttc into line_totals from public.customer_credit_note_lines where credit_note_id=new.id and organization_id=new.organization_id;
        if line_totals.n=0 or new.total_ttc<=0 or (new.subtotal_ht,new.discount_total,new.tax_total,new.total_ttc) is distinct from (line_totals.ht,line_totals.discount,line_totals.vat,line_totals.ttc) then raise exception 'CREDIT_INVALID_LINES' using errcode='23514'; end if;
      end if;
    end if;
    if tg_op<>'INSERT' and exists(select 1 from public.accounting_entries where organization_id=old.organization_id and source_document_type='customer_credit_note' and source_document_id=old.id and status='posted') then
      if tg_op='DELETE' then raise exception 'CREDIT_NOTE_POSTED_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['applied_amount','available_amount','updated_at','notes','internal_notes']) is distinct from (to_jsonb(old)-array['applied_amount','available_amount','updated_at','notes','internal_notes'])
        and not (new.status in ('validated','partially_applied','applied') and (to_jsonb(new)-array['applied_amount','available_amount','updated_at','notes','internal_notes','status']) is not distinct from (to_jsonb(old)-array['applied_amount','available_amount','updated_at','notes','internal_notes','status'])) then
        raise exception 'CREDIT_NOTE_POSTED_READ_ONLY' using errcode='42501';
      end if;
    end if;
  else
    if tg_table_name='customer_credit_note_lines' and tg_op='UPDATE' and (new.organization_id is distinct from old.organization_id or new.credit_note_id is distinct from old.credit_note_id) then raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode='23514'; end if;
    row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
    select * into note from public.customer_credit_notes where id=(row_data->>'credit_note_id')::uuid and organization_id=(row_data->>'organization_id')::uuid for update;
    if not found then raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode='23514'; end if;
    if tg_table_name='customer_credit_note_lines' and note.status<>'draft' then raise exception 'CREDIT_NOTE_LINES_READ_ONLY' using errcode='42501'; end if;
    if tg_table_name='customer_credit_note_lines' and tg_op<>'DELETE' then
      if new.quantity is null or new.unit_price_ht is null or new.quantity::text in ('NaN','Infinity','-Infinity') or new.unit_price_ht::text in ('NaN','Infinity','-Infinity') or new.discount_rate::text in ('NaN','Infinity','-Infinity') or new.tax_rate::text in ('NaN','Infinity','-Infinity') or new.quantity<=0 or new.unit_price_ht<0 or new.discount_rate not between 0 and 100 or new.tax_rate not between 0 and 100 or nullif(btrim(new.description),'') is null then raise exception 'CREDIT_INVALID_LINES' using errcode='23514'; end if;
      if new.product_id is not null and not exists(select 1 from public.products where id=new.product_id and organization_id=new.organization_id and archived_at is null) then raise exception 'CREDIT_INVALID_PRODUCT' using errcode='23514'; end if;
      if new.unit_id is not null and not exists(select 1 from public.units where id=new.unit_id and (organization_id=new.organization_id or organization_id is null)) then raise exception 'CREDIT_INVALID_UNIT' using errcode='23514'; end if;
      if new.tax_rate_id is not null and not exists(select 1 from public.tax_rates where id=new.tax_rate_id and (organization_id=new.organization_id or organization_id is null)) then raise exception 'CREDIT_INVALID_TAX' using errcode='23514'; end if;
      if new.source_invoice_line_id is not null and not exists(select 1 from public.customer_invoice_lines l join public.customer_invoices i on i.id=l.invoice_id where l.id=new.source_invoice_line_id and i.organization_id=new.organization_id and i.customer_id=note.customer_id and (note.source_invoice_id is null or i.id=note.source_invoice_id)) then raise exception 'CREDIT_INVALID_SOURCE_LINE' using errcode='23514'; end if;
      gross:=round(new.quantity*new.unit_price_ht,2); new.discount_amount:=round(gross*new.discount_rate/100,2); new.subtotal_ht:=gross-new.discount_amount; new.tax_amount:=round(new.subtotal_ht*new.tax_rate/100,2); new.total_ttc:=new.subtotal_ht+new.tax_amount;
    end if;
    if tg_table_name='customer_credit_note_applications' then
      if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.credit_note_id<>old.credit_note_id or new.invoice_id<>old.invoice_id or new.customer_id<>old.customer_id) then raise exception 'CREDIT_APPLICATION_RELATION_READ_ONLY' using errcode='42501'; end if;
      if not exists(select 1 from public.customer_invoices where id=(row_data->>'invoice_id')::uuid and organization_id=note.organization_id and customer_id=note.customer_id and currency=note.currency)
        or (row_data->>'customer_id')::uuid<>note.customer_id then raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode='23514'; end if;
      if tg_op<>'DELETE' and new.cancelled_at is null then
        if note.status not in ('validated','partially_applied','applied') then raise exception 'CREDIT_NOT_AVAILABLE' using errcode='23514'; end if;
        select coalesce(sum(amount),0) into used from public.customer_credit_note_applications where credit_note_id=note.id and organization_id=note.organization_id and cancelled_at is null and id<>new.id;
        if used+new.amount>note.total_ttc then raise exception 'CREDIT_INSUFFICIENT_AVAILABLE' using errcode='23514'; end if;
        select total_ttc,paid_amount into invoice_total,invoice_paid from public.customer_invoices where id=new.invoice_id and organization_id=new.organization_id and status not in ('draft','cancelled') and archived_at is null for update;
        if not found then raise exception 'CREDIT_INVALID_INVOICE' using errcode='23514'; end if;
        select coalesce(sum(amount),0) into invoice_used from public.customer_credit_note_applications where invoice_id=new.invoice_id and organization_id=new.organization_id and cancelled_at is null and id<>new.id;
        if invoice_used+new.amount>invoice_total-invoice_paid then raise exception 'CREDIT_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.guard_essential_credit_note() from public,anon;
drop trigger if exists essential_credit_note_v10 on public.customer_credit_notes;
create trigger essential_credit_note_v10 before insert or update or delete on public.customer_credit_notes for each row execute function app_private.guard_essential_credit_note();
drop trigger if exists essential_credit_note_lines_v10 on public.customer_credit_note_lines;
create trigger essential_credit_note_lines_v10 before insert or update or delete on public.customer_credit_note_lines for each row execute function app_private.guard_essential_credit_note();
drop trigger if exists essential_credit_note_applications_v10 on public.customer_credit_note_applications;
create trigger essential_credit_note_applications_v10 before insert or update or delete on public.customer_credit_note_applications for each row execute function app_private.guard_essential_credit_note();

create or replace function public.save_customer_credit_note_atomic(p_organization_id uuid,p_credit_note_id uuid,p_header jsonb,p_lines jsonb)
returns uuid language plpgsql security invoker set search_path=public,app_private
as $$
declare
  note_id uuid:=p_credit_note_id; customer uuid; source_invoice uuid; source_return uuid; existing public.customer_credit_notes%rowtype;
  line jsonb; prepared jsonb:='[]'::jsonb; qty numeric; price numeric; discount numeric; rate numeric; ht numeric; vat numeric; ttc numeric; gross numeric;
  total_ht numeric:=0; total_vat numeric:=0; sum_ttc numeric:=0; total_discount numeric:=0; idx integer:=0;
  product uuid; unit uuid; tax uuid; invoice_line uuid;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_header) is distinct from 'object' or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'CREDIT_INVALID_LINES' using errcode='22023'; end if;
  customer:=nullif(p_header->>'customer_id','')::uuid; source_invoice:=nullif(p_header->>'source_invoice_id','')::uuid; source_return:=nullif(p_header->>'source_return_id','')::uuid;
  if not exists(select 1 from public.third_parties where id=customer and organization_id=p_organization_id and archived_at is null and status='active' and ('customer'=any(types) or primary_type='customer')) then raise exception 'CREDIT_INVALID_CUSTOMER' using errcode='23514'; end if;
  if source_invoice is not null and not exists(select 1 from public.customer_invoices where id=source_invoice and organization_id=p_organization_id and customer_id=customer and status not in ('draft','cancelled') and archived_at is null and currency='MAD') then raise exception 'CREDIT_INVALID_SOURCE' using errcode='23514'; end if;
  if source_return is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':credit_return:'||source_return::text,0));
    if not exists(select 1 from public.sales_documents where id=source_return and organization_id=p_organization_id and customer_id=customer and document_type='return_note' and status='validated' and archived_at is null)
      or exists(select 1 from public.customer_credit_notes where organization_id=p_organization_id and source_return_id=source_return and status<>'cancelled' and archived_at is null and (note_id is null or id<>note_id)) then raise exception 'CREDIT_INVALID_SOURCE' using errcode='23514'; end if;
  end if;
  if note_id is not null then
    select * into existing from public.customer_credit_notes where id=note_id and organization_id=p_organization_id and archived_at is null for update;
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
    if invoice_line is not null and not exists(select 1 from public.customer_invoice_lines l join public.customer_invoices i on i.id=l.invoice_id where l.id=invoice_line and i.organization_id=p_organization_id and i.customer_id=customer and (source_invoice is null or i.id=source_invoice)) then raise exception 'CREDIT_INVALID_SOURCE_LINE' using errcode='23514'; end if;
    gross:=round(qty*price,2); ht:=gross-round(gross*discount/100,2); vat:=round(ht*rate/100,2); ttc:=ht+vat;
    total_ht:=total_ht+ht; total_vat:=total_vat+vat; sum_ttc:=sum_ttc+ttc; total_discount:=total_discount+round(gross*discount/100,2);
    prepared:=prepared||jsonb_build_array(jsonb_build_object('line_order',idx,'product_id',product,'product_name',nullif(line->>'product_name',''),'description',btrim(line->>'description'),'quantity',qty,'unit_id',unit,'unit_name',nullif(line->>'unit_name',''),'unit_price_ht',price,'discount_rate',discount,'tax_rate_id',tax,'tax_rate',rate,'subtotal_ht',ht,'discount_amount',round(gross*discount/100,2),'tax_amount',vat,'total_ttc',ttc,'source_invoice_line_id',invoice_line));
  end loop;
  if sum_ttc<=0 then raise exception 'CREDIT_INVALID_TOTAL' using errcode='23514'; end if;
  if note_id is null then
    insert into public.customer_credit_notes(organization_id,credit_note_number,customer_id,source_invoice_id,source_return_id,source_type,credit_note_date,subtotal_ht,discount_total,tax_total,total_ttc,currency,reason,notes,internal_notes,created_by)
    values(p_organization_id,null,customer,source_invoice,source_return,coalesce(nullif(p_header->>'source_type',''),'manual'),coalesce(nullif(p_header->>'credit_note_date','')::date,current_date),total_ht,total_discount,total_vat,sum_ttc,'MAD',p_header->>'reason',p_header->>'notes',p_header->>'internal_notes',auth.uid()) returning id into note_id;
  else
    update public.customer_credit_notes set customer_id=customer,source_invoice_id=source_invoice,source_return_id=source_return,source_type=coalesce(nullif(p_header->>'source_type',''),'manual'),credit_note_date=coalesce(nullif(p_header->>'credit_note_date','')::date,current_date),subtotal_ht=total_ht,discount_total=total_discount,tax_total=total_vat,total_ttc=sum_ttc,reason=p_header->>'reason',notes=p_header->>'notes',internal_notes=p_header->>'internal_notes' where id=note_id and organization_id=p_organization_id;
    delete from public.customer_credit_note_lines where organization_id=p_organization_id and credit_note_id=note_id;
  end if;
  insert into public.customer_credit_note_lines(organization_id,credit_note_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc,source_invoice_line_id)
  select p_organization_id,note_id,x.line_order,x.product_id,x.product_name,x.description,x.quantity,x.unit_id,x.unit_name,x.unit_price_ht,x.discount_rate,x.tax_rate_id,x.tax_rate,x.subtotal_ht,x.discount_amount,x.tax_amount,x.total_ttc,x.source_invoice_line_id
  from jsonb_to_recordset(prepared) as x(line_order integer,product_id uuid,product_name text,description text,quantity numeric,unit_id uuid,unit_name text,unit_price_ht numeric,discount_rate numeric,tax_rate_id uuid,tax_rate numeric,subtotal_ht numeric,discount_amount numeric,tax_amount numeric,total_ttc numeric,source_invoice_line_id uuid);
  return note_id;
end $$;
revoke all on function public.save_customer_credit_note_atomic(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_customer_credit_note_atomic(uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function app_private.refresh_credit_note_balances(p_organization_id uuid,p_credit_note_id uuid)
returns void language plpgsql security invoker set search_path=public,app_private
as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  update public.customer_credit_notes n set applied_amount=x.amount,available_amount=greatest(n.total_ttc-x.amount,0),status=case when x.amount=0 then 'validated' when x.amount<n.total_ttc then 'partially_applied' else 'applied' end
  from (select coalesce(sum(amount),0) amount from public.customer_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id and cancelled_at is null) x
  where n.id=p_credit_note_id and n.organization_id=p_organization_id and n.status not in ('draft','cancelled');
  update public.customer_invoices i set credit_amount=x.amount,remaining_amount=greatest(i.total_ttc-i.paid_amount-x.amount,0),payment_status=case when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid' when i.paid_amount+x.amount>0 then 'partial' else 'unpaid' end,
    status=case when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid' when i.paid_amount+x.amount>0 then 'partially_paid' when i.status in ('paid','partially_paid') then case when i.sent_at is not null then 'sent' else 'validated' end else i.status end
  from (select invoice.id,coalesce(sum(a.amount) filter(where a.cancelled_at is null),0) amount from public.customer_invoices invoice left join public.customer_credit_note_applications a on a.invoice_id=invoice.id and a.organization_id=p_organization_id where invoice.organization_id=p_organization_id and invoice.id in(select invoice_id from public.customer_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id) group by invoice.id) x
  where i.id=x.id and i.organization_id=p_organization_id and i.status not in ('draft','cancelled');
end $$;
revoke all on function app_private.refresh_credit_note_balances(uuid,uuid) from public,anon;
grant execute on function app_private.refresh_credit_note_balances(uuid,uuid) to authenticated;

create or replace function app_private.refresh_credit_after_application()
returns trigger language plpgsql security invoker set search_path=public,app_private
as $$
begin
  perform app_private.refresh_credit_note_balances(case when tg_op='DELETE' then old.organization_id else new.organization_id end,case when tg_op='DELETE' then old.credit_note_id else new.credit_note_id end);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.refresh_credit_after_application() from public,anon;
drop trigger if exists essential_credit_application_refresh_v10 on public.customer_credit_note_applications;
create trigger essential_credit_application_refresh_v10 after insert or update or delete on public.customer_credit_note_applications for each row execute function app_private.refresh_credit_after_application();

create or replace function public.apply_customer_credit_note_atomic(p_organization_id uuid,p_credit_note_id uuid,p_applications jsonb)
returns void language plpgsql security invoker set search_path=public,app_private
as $$
declare note public.customer_credit_notes%rowtype; invoice public.customer_invoices%rowtype; application record; used numeric; wanted numeric;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_applications) is distinct from 'array' or jsonb_array_length(p_applications) not between 1 and 100 then raise exception 'CREDIT_INVALID_APPLICATION' using errcode='22023'; end if;
  select * into note from public.customer_credit_notes where id=p_credit_note_id and organization_id=p_organization_id and archived_at is null for update;
  if not found or note.status not in ('validated','partially_applied') then raise exception 'CREDIT_NOT_AVAILABLE' using errcode='23514'; end if;
  select coalesce(sum(amount),0) into used from public.customer_credit_note_applications where organization_id=p_organization_id and credit_note_id=note.id and cancelled_at is null;
  select sum(amount) into wanted from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric);
  if wanted is null or wanted::text in ('NaN','Infinity','-Infinity') or wanted<=0 or wanted>note.total_ttc-used or exists(select 1 from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric) where amount is null or amount::text in ('NaN','Infinity','-Infinity') or amount<=0 or amount<>round(amount,2) or invoice_id is null) then raise exception 'CREDIT_INSUFFICIENT_AVAILABLE' using errcode='23514'; end if;
  for application in select invoice_id,sum(amount) amount from jsonb_to_recordset(p_applications) x(invoice_id uuid,amount numeric) group by invoice_id order by invoice_id loop
    select * into invoice from public.customer_invoices where id=application.invoice_id and organization_id=p_organization_id and archived_at is null for update;
    if not found or invoice.customer_id<>note.customer_id or invoice.currency<>note.currency or invoice.status in ('draft','cancelled') then raise exception 'CREDIT_INVALID_INVOICE' using errcode='23514'; end if;
    if application.amount>invoice.remaining_amount then raise exception 'CREDIT_INVOICE_BALANCE_EXCEEDED' using errcode='23514'; end if;
    insert into public.customer_credit_note_applications(organization_id,credit_note_id,invoice_id,customer_id,amount,created_by) values(p_organization_id,note.id,invoice.id,note.customer_id,application.amount,auth.uid());
  end loop;
  perform app_private.refresh_credit_note_balances(p_organization_id,note.id);
end $$;
revoke all on function public.apply_customer_credit_note_atomic(uuid,uuid,jsonb) from public,anon;
grant execute on function public.apply_customer_credit_note_atomic(uuid,uuid,jsonb) to authenticated;

create or replace function public.unapply_customer_credit_note_atomic(p_organization_id uuid,p_application_id uuid)
returns uuid language plpgsql security invoker set search_path=public,app_private
as $$
declare application public.customer_credit_note_applications%rowtype; note_id uuid;
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  select credit_note_id into note_id from public.customer_credit_note_applications where id=p_application_id and organization_id=p_organization_id;
  if not found then raise exception 'CREDIT_APPLICATION_NOT_FOUND' using errcode='23514'; end if;
  perform 1 from public.customer_credit_notes where id=note_id and organization_id=p_organization_id for update;
  select * into application from public.customer_credit_note_applications where id=p_application_id and organization_id=p_organization_id for update;
  perform 1 from public.customer_invoices where id=application.invoice_id and organization_id=p_organization_id for update;
  update public.customer_credit_note_applications set cancelled_at=coalesce(cancelled_at,now()) where id=p_application_id and organization_id=p_organization_id;
  perform app_private.refresh_credit_note_balances(p_organization_id,note_id);
  return note_id;
end $$;
revoke all on function public.unapply_customer_credit_note_atomic(uuid,uuid) from public,anon;
grant execute on function public.unapply_customer_credit_note_atomic(uuid,uuid) to authenticated;

-- 101_essential_supplier_credit_notes.sql
-- SHA256 83c5096d29ecc9bee73080cb63a5b5580133e8e4fb001d7cdeb2fc45e25d870b
-- Essential supplier credit notes: received credits, never synthetic cash refunds.
-- Apply after 098, 099 and 100. No existing financial amount is rewritten.

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

select (to_regprocedure('public.save_customer_invoice_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.save_supplier_invoice_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.save_accounting_entry_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and exists(select 1 from pg_trigger where tgname='essential_posted_payment_v8' and tgrelid='public.customer_payments'::regclass)
  and exists(select 1 from pg_policies where tablename='third_party_contacts' and policyname='essential_readonly_insert_v8')
 ) as integrite_098_active,
  (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ensure_essential_trial')
  and exists(select 1 from pg_trigger where tgname='aa_essential_subscription_guard' and tgrelid='public.customer_invoices'::regclass)
  and exists(select 1 from pg_policy where polname='essential_billing_update_server_only')
  and exists(select 1 from pg_proc where proname='claim_stripe_event')) as abonnement_099_actif,
  (to_regprocedure('public.save_customer_credit_note_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.apply_customer_credit_note_atomic(uuid,uuid,jsonb)') is not null
  and to_regprocedure('public.unapply_customer_credit_note_atomic(uuid,uuid)') is not null
  and exists(select 1 from pg_policies where tablename='customer_credit_note_lines' and policyname='essential_credit_write_insert_v10')) as avoirs_100_actifs,
  (to_regprocedure('public.save_supplier_credit_note_atomic(uuid,uuid,jsonb,jsonb)') is not null
 and to_regprocedure('public.apply_supplier_credit_note_atomic(uuid,uuid,jsonb)') is not null
 and to_regprocedure('public.unapply_supplier_credit_note_atomic(uuid,uuid)') is not null
 and exists(select 1 from pg_trigger where tgname='supplier_credit_note_number_v11')
 and exists(select 1 from pg_policies where tablename='supplier_credit_note_applications' and policyname='essential_supplier_credit_write_insert_v11')) as avoirs_fournisseurs_101_actifs;
