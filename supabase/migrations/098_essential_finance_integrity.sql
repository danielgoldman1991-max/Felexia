-- Essential financial integrity. Additive, transactional; no historical amount,
-- document number, account currency or membership is rewritten.
begin;

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

commit;

select to_regprocedure('public.save_customer_invoice_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.save_supplier_invoice_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.save_accounting_entry_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and exists(select 1 from pg_trigger where tgname='essential_posted_payment_v8' and tgrelid='public.customer_payments'::regclass)
  and exists(select 1 from pg_policies where tablename='third_party_contacts' and policyname='essential_readonly_insert_v8')
  as integrite_098_active;
