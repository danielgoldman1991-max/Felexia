-- Felexia PRO105–106. Manual installation after104. No107 included.
-- One transaction: all functions/guards are installed together or rolled back.
begin;

-- SOURCE: 105_pro_commercial_transactions.sql
-- Apply manually after104. No existing document, amount or number is rewritten.

-- Monotone timestamp version, including repeated calls inside one transaction.
create or replace function app_private.bump_pro_edit_version()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end $$;
revoke all on function app_private.bump_pro_edit_version() from public,anon,authenticated,service_role;
drop trigger if exists zz_pro_edit_version_105 on public.sales_documents;
create trigger zz_pro_edit_version_105 before update on public.sales_documents for each row execute function app_private.bump_pro_edit_version();
drop trigger if exists zz_pro_edit_version_105 on public.purchase_documents;
create trigger zz_pro_edit_version_105 before update on public.purchase_documents for each row execute function app_private.bump_pro_edit_version();

create or replace function public.save_pro_commercial_document_atomic(
  p_organization_id uuid, p_document_id uuid, p_kind text,
  p_expected_updated_at timestamptz, p_header jsonb, p_lines jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare
  doc_id uuid; stamp timestamptz; current_status text; current_kind text;
  party_id uuid; line jsonb; product_id uuid; unit_id uuid; tax_id uuid;
  qty numeric; price numeric; discount numeric; rate numeric; reference_rate numeric;
  base numeric; reduction numeric; net numeric; tax numeric;
  sum_base numeric:=0; sum_discount numeric:=0; sum_net numeric:=0; sum_tax numeric:=0;
  idx integer:=0; party_field text;
begin
  if auth.uid() is null then raise exception 'PRO_AUTH_REQUIRED' using errcode='42501'; end if;
  perform app_private.assert_pro_write_access(p_organization_id,true);
  if not app_private.is_org_member(p_organization_id) or app_private.is_read_only_org_member(p_organization_id)
    or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'PRO_WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('quote','order','supplier_order')
    or jsonb_typeof(p_header) is distinct from 'object'
    or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) not between 1 and 500 then
    raise exception 'PRO_INVALID_DOCUMENT' using errcode='23514';
  end if;
  party_field:=case when p_kind='supplier_order' then 'supplier_id' else 'customer_id' end;
  party_id:=nullif(p_header->>party_field,'')::uuid;
  if party_id is null or not exists(select 1 from public.third_parties where id=party_id and organization_id=p_organization_id and archived_at is null and status='active'
    and case when p_kind='supplier_order' then 'supplier'=any(types)
      else types && array['customer','prospect']::text[] end) then
    raise exception 'PRO_RELATED_RECORD_INVALID' using errcode='23514';
  end if;
  if p_document_id is not null then
    if p_kind='supplier_order' then
      select id,updated_at,status,document_type into doc_id,stamp,current_status,current_kind from public.purchase_documents
        where id=p_document_id and organization_id=p_organization_id and archived_at is null for update;
    else
      select id,updated_at,status,document_type into doc_id,stamp,current_status,current_kind from public.sales_documents
        where id=p_document_id and organization_id=p_organization_id and archived_at is null for update;
    end if;
    if doc_id is null then raise exception 'PRO_DOCUMENT_NOT_FOUND' using errcode='42501'; end if;
    if current_status<>'draft' or current_kind<>p_kind then raise exception 'PRO_DRAFT_REQUIRED' using errcode='42501'; end if;
    if p_expected_updated_at is null or stamp is distinct from p_expected_updated_at then
      raise exception 'PRO_DOCUMENT_CHANGED' using errcode='40001';
    end if;
  end if;
  -- Inserting the header and replacing lines occur in this same transaction.
  if doc_id is null then
    if p_kind='supplier_order' then
      insert into public.purchase_documents(organization_id,document_type,document_number,supplier_id,document_date,expected_receipt_date,notes,internal_notes,created_by)
        values(p_organization_id,p_kind,'',party_id,coalesce(nullif(p_header->>'document_date','')::date,current_date),nullif(p_header->>'expected_receipt_date','')::date,p_header->>'notes',p_header->>'internal_notes',auth.uid()) returning id into doc_id;
    else
      insert into public.sales_documents(organization_id,document_type,document_number,customer_id,document_date,created_by)
        values(p_organization_id,p_kind,'',party_id,coalesce(nullif(p_header->>'document_date','')::date,current_date),auth.uid()) returning id into doc_id;
    end if;
  end if;
  if p_kind='supplier_order' then
    delete from public.purchase_document_lines where organization_id=p_organization_id and document_id=doc_id;
  else
    delete from public.sales_document_lines where organization_id=p_organization_id and document_id=doc_id;
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    idx:=idx+1;
    product_id:=nullif(line->>'product_id','')::uuid;
    unit_id:=nullif(line->>'unit_id','')::uuid;
    tax_id:=nullif(line->>'tax_rate_id','')::uuid;
    if (product_id is not null and not exists(select 1 from public.products where id=product_id and organization_id=p_organization_id and archived_at is null))
      or (unit_id is not null and not exists(select 1 from public.units where id=unit_id and organization_id=p_organization_id))
      or (tax_id is not null and not exists(select 1 from public.tax_rates where id=tax_id and (organization_id=p_organization_id or organization_id is null))) then
      raise exception 'PRO_RELATED_RECORD_INVALID' using errcode='23514';
    end if;
    qty:=(line->>'quantity')::numeric; price:=(line->>'unit_price_ht')::numeric;
    discount:=coalesce(nullif(line->>'discount_rate','')::numeric,0); rate:=coalesce(nullif(line->>'tax_rate','')::numeric,0);
    if qty is null or price is null or qty::text in ('NaN','Infinity','-Infinity') or price::text in ('NaN','Infinity','-Infinity')
      or discount::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity')
      or qty<=0 or price<0 or discount not between 0 and 100 or rate not between 0 and 100
      or qty<>round(qty,3) or price<>round(price,2) or discount<>round(discount,2) or rate<>round(rate,2)
      or nullif(btrim(line->>'description'),'') is null then
      raise exception 'PRO_INVALID_LINE' using errcode='23514';
    end if;
    if (lower(btrim(coalesce(line->>'unit_name','')))='u' or exists(select 1 from public.units where id=unit_id and
      (lower(btrim(coalesce(symbol,'')))='u' or lower(btrim(coalesce(name,'')))='u'))) and qty<>trunc(qty) then
      raise exception 'PRO_INDIVISIBLE_QUANTITY' using errcode='23514';
    end if;
    if tax_id is not null then
      select tax_rates.rate into reference_rate from public.tax_rates where id=tax_id and (organization_id=p_organization_id or organization_id is null) for share;
      if reference_rate is distinct from rate then raise exception 'PRO_TAX_RATE_CHANGED' using errcode='40001'; end if;
    end if;
    base:=round(qty*price,2); reduction:=round(base*discount/100,2);
    net:=case when p_kind='supplier_order' then base-reduction else round(qty*price*(1-discount/100),2) end;
    tax:=round(net*rate/100,2);
    if p_kind='supplier_order' then
      insert into public.purchase_document_lines(organization_id,document_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc,ordered_quantity)
        values(p_organization_id,doc_id,idx,product_id,line->>'product_name',line->>'description',qty,unit_id,line->>'unit_name',price,discount,tax_id,rate,base,reduction,tax,net+tax,qty);
    else
      insert into public.sales_document_lines(organization_id,document_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,tax_amount,total_ttc)
        values(p_organization_id,doc_id,idx,product_id,line->>'product_name',line->>'description',qty,unit_id,line->>'unit_name',price,discount,tax_id,rate,net,tax,net+tax);
    end if;
    sum_base:=sum_base+base; sum_discount:=sum_discount+reduction; sum_net:=sum_net+net; sum_tax:=sum_tax+tax;
  end loop;
  if p_kind='supplier_order' then
    update public.purchase_documents set supplier_id=party_id,document_date=coalesce(nullif(p_header->>'document_date','')::date,current_date),
      expected_receipt_date=nullif(p_header->>'expected_receipt_date','')::date,notes=p_header->>'notes',internal_notes=p_header->>'internal_notes',
      subtotal_ht=sum_base,discount_total=sum_discount,tax_total=sum_tax,total_ttc=sum_net+sum_tax
      where id=doc_id and organization_id=p_organization_id;
  else
    update public.sales_documents set customer_id=party_id,document_date=coalesce(nullif(p_header->>'document_date','')::date,current_date),
      valid_until=case when p_kind='quote' then nullif(p_header->>'valid_until','')::date else valid_until end,
      expected_delivery_date=case when p_kind='order' then nullif(p_header->>'expected_delivery_date','')::date else expected_delivery_date end,
      notes=p_header->>'notes',internal_notes=p_header->>'internal_notes',payment_terms=p_header->>'payment_terms',payment_method=p_header->>'payment_method',
      payment_terms_days=nullif(p_header->>'payment_terms_days','')::integer,custom_payment_terms=p_header->>'custom_payment_terms',custom_payment_method=p_header->>'custom_payment_method',
      subtotal_ht=sum_net,tax_total=sum_tax,total_ttc=sum_net+sum_tax where id=doc_id and organization_id=p_organization_id;
  end if;
  return doc_id;
end $$;
revoke all on function public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb) to authenticated;

create or replace function public.convert_pro_quote_to_order_atomic(p_organization_id uuid,p_quote_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare quote public.sales_documents%rowtype; order_id uuid;
begin
  if auth.uid() is null then raise exception 'PRO_AUTH_REQUIRED' using errcode='42501'; end if;
  perform app_private.assert_pro_write_access(p_organization_id,true);
  if not app_private.is_org_member(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'PRO_WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
  select * into quote from public.sales_documents where id=p_quote_id and organization_id=p_organization_id and archived_at is null for update;
  if quote.id is null or quote.document_type<>'quote' then raise exception 'PRO_DOCUMENT_NOT_FOUND' using errcode='42501'; end if;
  -- Repeating the conversion returns its existing order, including after a
  -- concurrent first request. It never creates a second order for this quote.
  if quote.status='converted' then
    select id into order_id from public.sales_documents where id=quote.related_order_id and organization_id=p_organization_id and document_type='order' and source_document_id=quote.id;
    if order_id is null then raise exception 'PRO_QUOTE_CONVERSION_INCONSISTENT' using errcode='23514'; end if;
    return order_id;
  end if;
  if quote.status not in ('draft','sent','accepted') then raise exception 'PRO_DRAFT_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.third_parties where id=quote.customer_id and organization_id=p_organization_id and archived_at is null and status='active' and types && array['customer','prospect']::text[]) then
    raise exception 'PRO_RELATED_RECORD_INVALID' using errcode='23514';
  end if;
  if quote.subtotal_ht::text in ('NaN','Infinity','-Infinity') or quote.tax_total::text in ('NaN','Infinity','-Infinity') or quote.total_ttc::text in ('NaN','Infinity','-Infinity') then
    raise exception 'PRO_INVALID_DOCUMENT' using errcode='23514';
  end if;
  perform id from public.sales_document_lines where document_id=quote.id order by id for share;
  if not exists(select 1 from public.sales_document_lines where document_id=quote.id and organization_id=p_organization_id)
    or exists(select 1 from public.sales_document_lines l where l.document_id=quote.id and
      (l.organization_id<>p_organization_id
      or (l.product_id is not null and not exists(select 1 from public.products p where p.id=l.product_id and p.organization_id=p_organization_id))
      or (l.unit_id is not null and not exists(select 1 from public.units u where u.id=l.unit_id and u.organization_id=p_organization_id))
      or (l.tax_rate_id is not null and not exists(select 1 from public.tax_rates t where t.id=l.tax_rate_id and (t.organization_id=p_organization_id or t.organization_id is null))))) then
    raise exception 'PRO_RELATED_RECORD_INVALID' using errcode='23514';
  end if;
  if exists(select 1 from public.sales_document_lines l cross join lateral unnest(array[l.quantity,l.unit_price_ht,l.discount_rate,l.tax_rate,l.subtotal_ht,l.tax_amount,l.total_ttc]) value
    where l.document_id=quote.id and (value is null or value::text in ('NaN','Infinity','-Infinity') or value<0 or l.quantity<=0
      or ((lower(btrim(coalesce(l.unit_name,'')))='u' or exists(select 1 from public.units u where u.id=l.unit_id and (lower(btrim(u.name))='u' or lower(btrim(u.symbol))='u'))) and l.quantity<>trunc(l.quantity)))) then
    raise exception 'PRO_INVALID_LINE' using errcode='23514';
  end if;
  if exists(select 1 from (select sum(subtotal_ht) ht,sum(tax_amount) vat,sum(total_ttc) ttc from public.sales_document_lines where document_id=quote.id) totals
    where totals.ht is distinct from quote.subtotal_ht or totals.vat is distinct from quote.tax_total or totals.ttc is distinct from quote.total_ttc) then
    raise exception 'PRO_INVALID_DOCUMENT' using errcode='23514';
  end if;
  -- Preserve the accepted quote's exact amounts and terms, not current rates.
  insert into public.sales_documents(organization_id,document_type,document_number,customer_id,source_document_id,document_date,status,subtotal_ht,tax_total,total_ttc,notes,internal_notes,payment_terms,payment_method,payment_terms_days,custom_payment_terms,custom_payment_method,created_by)
    values(p_organization_id,'order','',quote.customer_id,quote.id,current_date,'draft',quote.subtotal_ht,quote.tax_total,quote.total_ttc,quote.notes,quote.internal_notes,quote.payment_terms,quote.payment_method,quote.payment_terms_days,quote.custom_payment_terms,quote.custom_payment_method,auth.uid()) returning id into order_id;
  insert into public.sales_document_lines(organization_id,document_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,tax_amount,total_ttc)
    select p_organization_id,order_id,line_order,product_id,product_name,description,quantity,unit_id,unit_name,unit_price_ht,discount_rate,tax_rate_id,tax_rate,subtotal_ht,tax_amount,total_ttc
    from public.sales_document_lines where document_id=quote.id and organization_id=p_organization_id order by line_order;
  update public.sales_documents set status='converted',related_order_id=order_id where id=quote.id and organization_id=p_organization_id;
  return order_id;
end $$;
revoke all on function public.convert_pro_quote_to_order_atomic(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.convert_pro_quote_to_order_atomic(uuid,uuid) to authenticated;

create or replace function public.pro_transaction_capabilities(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,app_private as $$
begin
  if auth.uid() is null or not app_private.is_org_member(p_organization_id) then raise exception 'PRO_AUTH_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object('commercial_version',105,'atomic_commercial',true,'atomic_conversion',true,'atomic_payroll',to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)') is not null);
end $$;
revoke all on function public.pro_transaction_capabilities(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pro_transaction_capabilities(uuid) to authenticated;
notify pgrst,'reload schema';

-- SOURCE: 106_preparatory_payroll_transactions.sql
-- Apply manually after105. Existing salaries, rates and payslips are preserved.
-- Base-only preparation; this migration does not enable final payroll or filing.

create or replace function app_private.guard_preparatory_payroll()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.status in ('validated','paid') then
    raise exception 'PAYROLL_PREPARATORY_ONLY' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_preparatory_payroll() from public,anon,authenticated,service_role;
drop trigger if exists aa_preparatory_only_106 on public.hr_payroll_periods;
create trigger aa_preparatory_only_106 before insert or update on public.hr_payroll_periods for each row execute function app_private.guard_preparatory_payroll();
drop trigger if exists aa_preparatory_only_106 on public.hr_payslips;
create trigger aa_preparatory_only_106 before insert or update on public.hr_payslips for each row execute function app_private.guard_preparatory_payroll();
drop trigger if exists zz_pro_edit_version_106 on public.hr_payroll_periods;
create trigger zz_pro_edit_version_106 before update on public.hr_payroll_periods for each row execute function app_private.bump_pro_edit_version();

-- NOT VALID preserves historical rows; new/changed rows must contain real amounts.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='hr_employee_salary_valid_106' and conrelid='public.hr_employees'::regclass) then
    alter table public.hr_employees add constraint hr_employee_salary_valid_106 check(base_salary is not null and base_salary>=0 and base_salary::text not in ('NaN','Infinity','-Infinity')) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='hr_contract_salary_valid_106' and conrelid='public.hr_contracts'::regclass) then
    alter table public.hr_contracts add constraint hr_contract_salary_valid_106 check(base_salary is not null and base_salary>=0 and base_salary::text not in ('NaN','Infinity','-Infinity') and weekly_hours>0 and (end_date is null or end_date>=start_date)) not valid;
  end if;
end $$;

create or replace function public.prepare_hr_payroll_atomic(
  p_organization_id uuid,p_period_id uuid,p_expected_updated_at timestamptz,p_ack_base_only boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare
  period public.hr_payroll_periods%rowtype; settings public.hr_settings%rowtype;
  employee public.hr_employees%rowtype; bracket jsonb; item jsonb;
  base numeric; cnss_base numeric; cnss numeric; amo numeric; taxable numeric; ir numeric;
  cnss_er numeric; amo_er numeric; net numeric; cost numeric;
  v_total_gross numeric:=0; v_total_net numeric:=0; v_total_cost numeric:=0; employee_count integer:=0;
  rates numeric[]; rate numeric; deduction numeric; previous_to numeric:=-1; lower_bound numeric; upper_bound numeric;
begin
  if auth.uid() is null then raise exception 'PRO_AUTH_REQUIRED' using errcode='42501'; end if;
  perform app_private.assert_pro_write_access(p_organization_id,true);
  if not public.hr_can_manage(p_organization_id) or app_private.is_operator_org_member(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then
    raise exception 'HR_MANAGEMENT_REQUIRED' using errcode='42501';
  end if;
  if p_ack_base_only is distinct from true then raise exception 'PAYROLL_BASE_ONLY_ACK_REQUIRED' using errcode='23514'; end if;
  select * into period from public.hr_payroll_periods where id=p_period_id and organization_id=p_organization_id for update;
  if period.id is null then raise exception 'PAYROLL_PERIOD_NOT_FOUND' using errcode='42501'; end if;
  if period.status not in ('draft','calculated') then raise exception 'PAYROLL_PERIOD_FINALIZED' using errcode='42501'; end if;
  if p_expected_updated_at is null or period.updated_at is distinct from p_expected_updated_at then raise exception 'PAYROLL_PERIOD_CHANGED' using errcode='40001'; end if;
  select * into settings from public.hr_settings where organization_id=p_organization_id for share;
  if settings.id is null or settings.cnss_enabled is null or settings.amo_enabled is null or settings.ir_enabled is null
    or coalesce(settings.payroll_currency,'')<>'MAD' then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
  rates:='{}'::numeric[];
  if settings.cnss_enabled then
    if settings.cnss_employee_rate is null or settings.cnss_employer_rate is null or settings.cnss_monthly_ceiling is null
      or settings.cnss_monthly_ceiling::text in ('NaN','Infinity','-Infinity') or settings.cnss_monthly_ceiling<=0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    rates:=rates||array[settings.cnss_employee_rate,settings.cnss_employer_rate];
  end if;
  if settings.amo_enabled then
    if settings.amo_employee_rate is null or settings.amo_employer_rate is null then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    rates:=rates||array[settings.amo_employee_rate,settings.amo_employer_rate];
  end if;
  foreach rate in array rates loop
    if rate::text in ('NaN','Infinity','-Infinity') or rate<=0 or rate>100 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
  end loop;
  if settings.ir_enabled then
    if jsonb_typeof(settings.ir_brackets) is distinct from 'array' or jsonb_array_length(settings.ir_brackets)=0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    for item in select value from jsonb_array_elements(settings.ir_brackets) loop
      lower_bound:=(item->>'from')::numeric; upper_bound:=nullif(item->>'to','')::numeric; rate:=(item->>'rate')::numeric;
      deduction:=coalesce((item->>'deduction')::numeric,0);
      if lower_bound is null or rate is null or lower_bound::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity')
        or lower_bound<0 or lower_bound<=previous_to or rate<0 or rate>100
        or (upper_bound is not null and (upper_bound::text in ('NaN','Infinity','-Infinity') or upper_bound<lower_bound))
        or deduction::text in ('NaN','Infinity','-Infinity') or deduction<0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
      previous_to:=coalesce(upper_bound,'Infinity'::numeric);
    end loop;
  end if;
  -- Lock inputs and existing outputs before validating the entire set.
  perform id from public.hr_employees where organization_id=p_organization_id order by id for share;
  perform id from public.hr_payslips where organization_id=p_organization_id and payroll_period_id=p_period_id order by id for update;
  if exists(select 1 from public.hr_payslips s left join public.hr_employees e on e.id=s.employee_id and e.organization_id=p_organization_id
    where s.organization_id=p_organization_id and s.payroll_period_id=p_period_id and
      (s.status not in ('draft','calculated') or e.id is null or e.archived_at is not null or e.employment_status not in ('active','trial_period','on_leave'))) then
    raise exception 'PAYROLL_EXISTING_SLIPS_LOCKED' using errcode='42501';
  end if;
  for employee in select * from public.hr_employees where organization_id=p_organization_id and archived_at is null and employment_status in ('active','trial_period','on_leave') order by id for share loop
    base:=employee.base_salary;
    if base is null or base<0 or base::text in ('NaN','Infinity','-Infinity') then raise exception 'PAYROLL_INVALID_SALARY' using errcode='23514'; end if;
    cnss_base:=case when settings.cnss_enabled then least(base,settings.cnss_monthly_ceiling) else base end;
    cnss:=case when settings.cnss_enabled then round(cnss_base*settings.cnss_employee_rate/100,2) else 0 end;
    amo:=case when settings.amo_enabled then round(base*settings.amo_employee_rate/100,2) else 0 end;
    taxable:=base-cnss-amo; ir:=0;
    if settings.ir_enabled then
      select value into bracket from jsonb_array_elements(settings.ir_brackets) where taxable>=(value->>'from')::numeric and ((value->>'to') is null or taxable<=(value->>'to')::numeric);
      if bracket is null then raise exception 'PAYROLL_IR_BRACKET_MISSING' using errcode='23514'; end if;
      ir:=round(greatest(0,taxable*(bracket->>'rate')::numeric/100-coalesce((bracket->>'deduction')::numeric,0)),2);
    end if;
    net:=base-cnss-amo-ir;
    cnss_er:=case when settings.cnss_enabled then round(cnss_base*settings.cnss_employer_rate/100,2) else 0 end;
    amo_er:=case when settings.amo_enabled then round(base*settings.amo_employer_rate/100,2) else 0 end;
    cost:=base+cnss_er+amo_er;
    foreach rate in array array[base,cnss_base,cnss,amo,taxable,ir,net,cnss_er,amo_er,cost] loop
      if rate is null or rate::text in ('NaN','Infinity','-Infinity') or rate<0 then raise exception 'PAYROLL_INVALID_NET' using errcode='23514'; end if;
    end loop;
    insert into public.hr_payslips(organization_id,payroll_period_id,employee_id,payslip_number,base_salary,gross_salary,taxable_gross,net_salary,net_to_pay,employer_cost,cnss_employee,amo_employee,ir_amount,cnss_employer,amo_employer,earnings,deductions,employer_contributions,calculation_details,status)
      values(p_organization_id,p_period_id,employee.id,'BUL-'||period.year||'-'||lpad(period.month::text,2,'0')||'-'||employee.id::text,base,base,taxable,net,net,cost,cnss,amo,ir,cnss_er,amo_er,
        jsonb_build_array(jsonb_build_object('code','BASE','label','Salaire de base','amount',base)),
        jsonb_build_array(jsonb_build_object('code','CNSS_EMP','label','CNSS salarié','amount',cnss),jsonb_build_object('code','AMO_EMP','label','AMO salarié','amount',amo),jsonb_build_object('code','IR','label','IR préparatoire','amount',ir)),
        jsonb_build_array(jsonb_build_object('code','CNSS_ER','label','CNSS employeur','amount',cnss_er),jsonb_build_object('code','AMO_ER','label','AMO employeur','amount',amo_er)),
        jsonb_build_object('schemaStatus','preparatory','scope','base_only','officialConformityClaim',false,'variablesIncluded',false,'settingsUpdatedAt',settings.updated_at,'warnings',jsonb_build_array('Primes, heures supplémentaires, absences, avances et prêts exclus. Ce calcul ne permet ni validation finale ni paiement.')),'calculated')
      on conflict(payroll_period_id,employee_id) do update set base_salary=excluded.base_salary,gross_salary=excluded.gross_salary,taxable_gross=excluded.taxable_gross,net_salary=excluded.net_salary,net_to_pay=excluded.net_to_pay,employer_cost=excluded.employer_cost,cnss_employee=excluded.cnss_employee,amo_employee=excluded.amo_employee,ir_amount=excluded.ir_amount,cnss_employer=excluded.cnss_employer,amo_employer=excluded.amo_employer,earnings=excluded.earnings,deductions=excluded.deductions,employer_contributions=excluded.employer_contributions,calculation_details=excluded.calculation_details,status='calculated';
    employee_count:=employee_count+1;v_total_gross:=v_total_gross+base;v_total_net:=v_total_net+net;v_total_cost:=v_total_cost+cost;
  end loop;
  update public.hr_payroll_periods set status='calculated',total_gross=v_total_gross,total_net=v_total_net,total_employer_cost=v_total_cost,employees_count=employee_count
    where id=p_period_id and organization_id=p_organization_id;
  return jsonb_build_object('scope','base_only_preparatory','employees_count',employee_count,'total_gross',v_total_gross,'total_net',v_total_net,'total_employer_cost',v_total_cost);
end $$;
revoke all on function public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) from public,anon,authenticated,service_role;
grant execute on function public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) to authenticated;
notify pgrst,'reload schema';

commit;

select to_regprocedure('public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamp with time zone,jsonb,jsonb)') is not null
  and to_regprocedure('public.convert_pro_quote_to_order_atomic(uuid,uuid)') is not null
  and exists(select 1 from pg_trigger where tgname='zz_pro_edit_version_105' and tgrelid='public.sales_documents'::regclass)
  and exists(select 1 from pg_trigger where tgname='zz_pro_edit_version_105' and tgrelid='public.purchase_documents'::regclass) as pro_105_actif;
select to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)') is not null
  and exists(select 1 from pg_trigger where tgname='aa_preparatory_only_106' and tgrelid='public.hr_payroll_periods'::regclass)
  and exists(select 1 from pg_trigger where tgname='aa_preparatory_only_106' and tgrelid='public.hr_payslips'::regclass) as pro_106_actif;
