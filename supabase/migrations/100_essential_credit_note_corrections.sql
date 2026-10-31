-- Essential credit-note correction workflows. No existing document is rewritten.
begin;

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

commit;

select to_regprocedure('public.save_customer_credit_note_atomic(uuid,uuid,jsonb,jsonb)') is not null
  and to_regprocedure('public.apply_customer_credit_note_atomic(uuid,uuid,jsonb)') is not null
  and to_regprocedure('public.unapply_customer_credit_note_atomic(uuid,uuid)') is not null
  and exists(select 1 from pg_policies where tablename='customer_credit_note_lines' and policyname='essential_credit_write_insert_v10') as avoirs_100_actifs;
