-- Rollback of 147. Restores the 145 restore function and the guards from 098/134.
-- Does not delete business data. Drops only the private restore marker.
-- Anonymous execution stays revoked.

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

create or replace function app_private.guard_essential_posted_entry()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare parent_status text;
begin
  if tg_table_name='accounting_entries' then
    if old.status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['label','reference','notes','updated_at'])
        is distinct from (to_jsonb(old)-array['label','reference','notes','updated_at']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501';
      end if;
    end if;
  else
    select status into parent_status from public.accounting_entries where id=(to_jsonb(old)->>'entry_id')::uuid;
    if parent_status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date'])
        is distinct from (to_jsonb(old)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function app_private.guard_essential_posted_entry() from public, anon, authenticated;

-- Additive restore entry point for an organization backup.
-- The caller must be owner or admin of the organization named in the argument.
-- Every row is forced onto that organization. A conflicting id owned by another
-- organization is left untouched. The function runs in one transaction: any
-- error rolls the whole restore back.

create or replace function public.restore_organization_backup(
  p_organization_id uuid,
  p_mode text,
  p_tables jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array[
    'company_settings','third_parties','products','customer_invoices','customer_invoice_lines',
    'customer_payments','supplier_invoices','supplier_invoice_lines','supplier_payments',
    'supplier_invoice_attachments','accounting_entries','accounting_entry_lines',
    'treasury_accounts','treasury_movements','hr_employees'
  ];
  item jsonb;
  row_data jsonb;
  v_table text;
  conflict_column text;
  assignment text;
  written integer := 0;
  skipped integer := 0;
  table_written integer;
  result jsonb := '[]'::jsonb;
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

  if p_mode = 'replace' then
    for item in select value from jsonb_array_elements(p_tables) with ordinality as listed(value, position) order by position desc
    loop
      v_table := item->>'name';
      if not (v_table = any (allowed)) or to_regclass('public.' || v_table) is null then
        continue;
      end if;
      execute format('delete from public.%I where organization_id = $1', v_table) using p_organization_id;
    end loop;
  end if;

  for item in select value from jsonb_array_elements(p_tables)
  loop
    v_table := item->>'name';
    if not (v_table = any (allowed)) then
      raise exception 'RESTORE_TABLE_FORBIDDEN' using errcode = '42501';
    end if;
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    conflict_column := case when v_table = 'company_settings' then 'organization_id' else 'id' end;
    select string_agg(format('%I = excluded.%I', columns.column_name, columns.column_name), ', ' order by columns.ordinal_position)
      into assignment
    from information_schema.columns as columns
    where columns.table_schema = 'public' and columns.table_name = v_table
      and columns.column_name <> conflict_column
      and columns.is_generated = 'NEVER';
    if assignment is null then
      continue;
    end if;
    table_written := 0;
    for row_data in select value from jsonb_array_elements(coalesce(item->'rows', '[]'::jsonb))
    loop
      row_data := row_data || jsonb_build_object('organization_id', p_organization_id);
      execute format(
        'with upserted as (
           insert into public.%1$I
           select rec.* from jsonb_populate_record(null::public.%1$I, $1) rec
           on conflict (%2$I) do update set %3$s
           where %1$I.organization_id = $2
           returning 1
         ) select count(*)::integer from upserted',
        v_table, conflict_column, assignment
      ) into written using row_data, p_organization_id;
      table_written := table_written + written;
      if written = 0 then skipped := skipped + 1; end if;
    end loop;
    result := result || jsonb_build_array(jsonb_build_object('name', v_table, 'written', table_written));
  end loop;

  return jsonb_build_object('mode', p_mode, 'tables', result, 'skipped', skipped);
end;
$$;

revoke all on function public.restore_organization_backup(uuid, text, jsonb) from public;
grant execute on function public.restore_organization_backup(uuid, text, jsonb) to authenticated;

revoke all on function public.restore_organization_backup(uuid, text, jsonb) from public, anon;
grant execute on function public.restore_organization_backup(uuid, text, jsonb) to authenticated;

drop function if exists app_private.organization_restore_active(uuid);
drop table if exists app_private.organization_restore_scope;
