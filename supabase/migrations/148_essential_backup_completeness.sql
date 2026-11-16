-- 148: complete organization backup, draft invoice deletion, and company settings writes.
-- Additive. Does not update or delete business data. Not applied by the application.
-- Rollback: supabase/rollbacks/148_essential_backup_completeness_rollback.sql

create or replace function app_private.guard_essential_invoice_lines()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $guard$
declare
  parent_table text := case when tg_table_name = 'customer_invoice_lines' then 'customer_invoices' else 'supplier_invoices' end;
  parent_status text;
  data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  gross numeric;
  net numeric;
  row_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.invoice_id is distinct from old.invoice_id) then
    raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode = '23514';
  end if;
  if app_private.organization_restore_active(row_org) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  execute format('select status from public.%I where id = $1 and organization_id = $2 for update', parent_table)
    into parent_status using (data->>'invoice_id')::uuid, (data->>'organization_id')::uuid;
  -- A draft invoice delete cascades to its lines after the parent row is already gone.
  if tg_op = 'DELETE' and parent_status is null then
    return old;
  end if;
  if parent_status is distinct from 'draft' then
    raise exception 'FINANCE_DRAFT_REQUIRED' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    if new.quantity is null or new.unit_price_ht is null
      or new.quantity::text in ('NaN','Infinity','-Infinity')
      or new.unit_price_ht::text in ('NaN','Infinity','-Infinity')
      or new.discount_rate::text in ('NaN','Infinity','-Infinity')
      or new.tax_rate::text in ('NaN','Infinity','-Infinity')
      or new.quantity <= 0 or new.unit_price_ht < 0
      or new.discount_rate not between 0 and 100
      or new.tax_rate not between 0 and 100
      or nullif(btrim(new.description), '') is null then
      raise exception 'FINANCE_INVALID_LINE' using errcode = '23514';
    end if;
    gross := round(new.quantity * new.unit_price_ht, 2);
    new.discount_amount := round(gross * new.discount_rate / 100, 2);
    net := gross - new.discount_amount;
    new.subtotal_ht := case when tg_table_name = 'supplier_invoice_lines' then gross else net end;
    new.tax_amount := round(net * new.tax_rate / 100, 2);
    new.total_ttc := net + new.tax_amount;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$guard$;

revoke all on function app_private.guard_essential_invoice_lines() from public, anon, authenticated;

create or replace function app_private.guard_essential_credit_note()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare note public.customer_credit_notes%rowtype; row_data jsonb; used numeric; invoice_total numeric; invoice_paid numeric; invoice_used numeric; line_totals record; gross numeric;
begin

  if app_private.organization_restore_active(case when tg_op = 'DELETE' then old.organization_id else new.organization_id end) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
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
    if not found then if tg_op = 'DELETE' then return old; end if; raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode = '23514'; end if;
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

revoke all on function app_private.guard_essential_credit_note() from public, anon, authenticated;

create or replace function app_private.guard_essential_supplier_credit_note()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare note public.supplier_credit_notes%rowtype; row_data jsonb; used numeric; invoice_total numeric; invoice_paid numeric; invoice_used numeric; line_totals record; gross numeric;
begin

  if app_private.organization_restore_active(case when tg_op = 'DELETE' then old.organization_id else new.organization_id end) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
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
    if not found then if tg_op = 'DELETE' then return old; end if; raise exception 'CREDIT_NOTE_TENANT_MISMATCH' using errcode = '23514'; end if;
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

revoke all on function app_private.guard_essential_supplier_credit_note() from public, anon, authenticated;

create or replace function public.restore_organization_backup(
  p_organization_id uuid,
  p_mode text,
  p_tables jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $restore$
declare
  allowed text[] := array[
    'company_settings','product_categories','units','tax_rates','accounting_journals','accounting_accounts',
    'third_parties','third_party_contacts','third_party_addresses','products',
    'customer_invoices','customer_invoice_lines','customer_credit_notes','customer_credit_note_lines',
    'customer_payments','customer_payment_allocations','customer_credit_note_applications',
    'supplier_invoices','supplier_invoice_lines','supplier_invoice_attachments',
    'supplier_credit_notes','supplier_credit_note_lines','supplier_payments','supplier_payment_allocations',
    'supplier_credit_note_applications','treasury_accounts','treasury_transactions',
    'accounting_entries','accounting_entry_lines','hr_departments','hr_positions','hr_employees'
  ];
  invoice_safe text[] := array[
    'notes','internal_notes','sent_at','updated_at','payment_status','paid_amount',
    'remaining_amount','credit_amount','cancelled_at'
  ];
  present text[];
  v_table text;
  conflict_column text;
  writable_names text[];
  generated_names text[];
  insert_names text[];
  update_names text[];
  insert_cols text;
  select_cols text;
  assignment text;
  row_data jsonb;
  existing_org uuid;
  existing_json jsonb;
  incoming_json jsonb;
  conflict_value uuid;
  parent_org uuid;
  parent_status text;
  parent_table text;
  new_document_ids uuid[] := '{}';
  table_written integer;
  skipped integer := 0;
  caught_state text;
  v_plan text;
  result jsonb := '[]'::jsonb;
  idx integer;
begin
  if p_mode not in ('merge', 'replace') then
    raise exception 'RESTORE_MODE' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.user_id = auth.uid()
      and member.organization_id = p_organization_id
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  ) then
    raise exception 'RESTORE_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tables) <> 'array' then
    raise exception 'RESTORE_PAYLOAD' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct value->>'name'), '{}')
    into present
  from jsonb_array_elements(p_tables)
  where value->>'name' is not null;

  foreach v_table in array present loop
    if not (v_table = any (allowed)) then
      raise exception 'RESTORE_TABLE_FORBIDDEN' using errcode = '42501';
    end if;
  end loop;

  insert into app_private.organization_restore_scope(txid, organization_id)
  values (txid_current(), p_organization_id)
  on conflict (txid) do update set organization_id = excluded.organization_id;

  select subscription.plan_code into v_plan
  from public.organization_subscriptions subscription
  where subscription.organization_id = p_organization_id
  order by subscription.created_at desc nulls last
  limit 1;

  if p_mode = 'replace' then
    for idx in reverse coalesce(array_length(allowed, 1), 0)..1 loop
      v_table := allowed[idx];
      if not (v_table = any (present)) or to_regclass('public.' || v_table) is null then
        continue;
      end if;
      if v_table like 'hr\_%' escape '\' and v_plan is not null and lower(v_plan) not in ('premium', 'pro') then
        continue;
      end if;
      begin
        execute format('delete from public.%I where organization_id = $1', v_table) using p_organization_id;
      exception when others then
        caught_state := sqlstate;
        raise exception 'RESTORE_BLOCKED|%|%', v_table, coalesce(caught_state, 'P0001') using errcode = 'P0001';
      end;
    end loop;
  end if;

  foreach v_table in array allowed loop
    if not (v_table = any (present)) or to_regclass('public.' || v_table) is null then
      continue;
    end if;
    if v_table like 'hr\_%' escape '\' and v_plan is not null and lower(v_plan) not in ('premium', 'pro') then
      result := result || jsonb_build_array(jsonb_build_object('name', v_table, 'written', 0, 'omitted', 'PRO_REQUIRED'));
      continue;
    end if;
    begin
      conflict_column := case when v_table = 'company_settings' then 'organization_id' else 'id' end;
      select
        coalesce(array_agg(attname::text order by attnum) filter (where attgenerated = '' and attidentity is distinct from 'a'), '{}'),
        coalesce(array_agg(attname::text order by attnum) filter (where attgenerated <> ''), '{}')
      into writable_names, generated_names
      from pg_attribute
      where attrelid = to_regclass('public.' || v_table)
        and attnum > 0
        and not attisdropped;
      table_written := 0;

      for row_data in
        select row_value
        from jsonb_array_elements(p_tables) item
        cross join lateral jsonb_array_elements(coalesce(item->'rows', '[]'::jsonb)) row_value
        where item->>'name' = v_table
      loop
        if conflict_column = 'id' then
          conflict_value := (row_data->>'id')::uuid;
          if conflict_value is null then
            raise exception 'RESTORE_ROW_KEY' using errcode = '22023';
          end if;
        else
          conflict_value := p_organization_id;
        end if;

        execute format(
          'select organization_id, to_jsonb(target_row) from public.%I target_row where %I = $1',
          v_table, conflict_column
        ) into existing_org, existing_json using conflict_value;
        if existing_org is not distinct from p_organization_id then
          execute format(
            'select to_jsonb(target_row) from public.%I target_row where %I = $1 and organization_id = $2 for update',
            v_table, conflict_column
          ) into existing_json using conflict_value, p_organization_id;
        end if;

        if existing_org is not null and existing_org is distinct from p_organization_id then
          skipped := skipped + 1;
          continue;
        end if;

        if v_table in ('customer_invoices', 'supplier_invoices')
          and (existing_org is null or existing_json->>'status' is not distinct from 'draft') then
          new_document_ids := array_append(new_document_ids, conflict_value);
        end if;

        if v_table in ('customer_invoice_lines', 'supplier_invoice_lines') then
          parent_table := case when v_table = 'customer_invoice_lines' then 'customer_invoices' else 'supplier_invoices' end;
          execute format('select organization_id, status from public.%I where id = $1', parent_table)
            into parent_org, parent_status using (row_data->>'invoice_id')::uuid;
          if parent_org is not null and parent_org is distinct from p_organization_id then
            skipped := skipped + 1;
            continue;
          end if;
          if parent_org = p_organization_id
            and parent_status is distinct from 'draft'
            and not ((row_data->>'invoice_id')::uuid = any (new_document_ids)) then
            skipped := skipped + 1;
            continue;
          end if;
        end if;

        row_data := (row_data - generated_names) || jsonb_build_object('organization_id', p_organization_id);
        execute format(
          'select to_jsonb(rec) - $2::text[] from jsonb_populate_record(null::public.%I, $1) rec',
          v_table
        ) into incoming_json using row_data, generated_names;

        if existing_org is not null and (existing_json - generated_names) = incoming_json then
          skipped := skipped + 1;
          continue;
        end if;

        if existing_org is null then
          select
            coalesce(string_agg(format('%I', name), ', ' order by ord), ''),
            coalesce(string_agg(format('rec.%I', name), ', ' order by ord), '')
          into insert_cols, select_cols
          from unnest(writable_names) with ordinality as names(name, ord)
          where exists (select 1 from jsonb_object_keys(row_data) as json_key where json_key = names.name);
          if insert_cols = '' then
            raise exception 'RESTORE_ROW_KEY' using errcode = '22023';
          end if;
          execute format(
            'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) rec',
            v_table, insert_cols, select_cols, v_table
          ) using row_data;
          table_written := table_written + 1;
        else
          if v_table in ('customer_invoices', 'supplier_invoices') and existing_json->>'status' is distinct from 'draft' then
            update_names := invoice_safe;
          elsif v_table in ('customer_invoices', 'supplier_invoices') then
            update_names := array_remove(array_remove(writable_names, 'id'), 'invoice_number');
          else
            update_names := array_remove(writable_names, conflict_column);
          end if;
          select coalesce(string_agg(format('%1$I = rec.%1$I', name), ', ' order by ord), '')
            into assignment
          from unnest(update_names) with ordinality as names(name, ord)
          where name = any (writable_names)
            and exists (select 1 from jsonb_object_keys(row_data) as json_key where json_key = names.name);
          if assignment = '' then
            skipped := skipped + 1;
            continue;
          end if;
          execute format(
            'update public.%1$I as target_row set %2$s from jsonb_populate_record(null::public.%1$I, $1) rec where target_row.%3$I = $2 and target_row.organization_id = $3',
            v_table, assignment, conflict_column
          ) using row_data, conflict_value, p_organization_id;
          table_written := table_written + 1;
        end if;
      end loop;
      result := result || jsonb_build_array(jsonb_build_object('name', v_table, 'written', table_written));
    exception when others then
      caught_state := sqlstate;
      raise exception 'RESTORE_BLOCKED|%|%', v_table, coalesce(caught_state, 'P0001') using errcode = 'P0001';
    end;
  end loop;

  delete from app_private.organization_restore_scope where txid = txid_current();
  return jsonb_build_object('mode', p_mode, 'tables', result, 'skipped', skipped);
end;
$restore$;

revoke all on function public.restore_organization_backup(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.restore_organization_backup(uuid, text, jsonb) to authenticated;

drop policy if exists company_settings_admin_update_148 on public.company_settings;
create policy company_settings_admin_update_148
on public.company_settings
as restrictive
for update
to authenticated
using (app_private.is_org_admin(organization_id))
with check (app_private.is_org_admin(organization_id));

drop policy if exists company_settings_admin_insert_148 on public.company_settings;
create policy company_settings_admin_insert_148
on public.company_settings
as restrictive
for insert
to authenticated
with check (app_private.is_org_admin(organization_id));

drop policy if exists organizations_admin_update_148 on public.organizations;
create policy organizations_admin_update_148
on public.organizations
as restrictive
for update
to authenticated
using (app_private.is_org_admin(id))
with check (app_private.is_org_admin(id));
