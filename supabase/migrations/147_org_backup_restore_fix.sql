-- 147: restore an organization backup without breaking invoice guards or generated columns.
-- Apply after 145. Number 146 belongs to the scheduled-backup migration.
-- This file only creates or replaces functions and one private session table.
-- It does not insert, update or delete any business row.
-- The restore bypass cannot be turned on from the API: only this security definer function
-- writes app_private.organization_restore_scope, and it deletes that row before returning.
-- Rollback: supabase/rollbacks/147_org_backup_restore_fix_rollback.sql

create table if not exists app_private.organization_restore_scope (
  txid bigint primary key,
  organization_id uuid not null
);

alter table app_private.organization_restore_scope enable row level security;
revoke all on table app_private.organization_restore_scope from public, anon, authenticated;

comment on table app_private.organization_restore_scope is
  'Transaction-local marker written only by restore_organization_backup. No client role can insert into it.';

create or replace function app_private.organization_restore_active(p_organization_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog, app_private
as $active$
  select exists (
    select 1
    from app_private.organization_restore_scope
    where txid = pg_catalog.txid_current()
      and organization_id = p_organization_id
  );
$active$;

revoke all on function app_private.organization_restore_active(uuid) from public, anon, authenticated;

comment on function app_private.organization_restore_active(uuid) is
  'True only while restore_organization_backup is writing the named organization in this transaction.';

create or replace function app_private.guard_essential_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $guard$
declare
  source_kind text := case when tg_table_name = 'customer_invoices' then 'customer_invoice' else 'supplier_invoice' end;
  data jsonb;
  previous jsonb := to_jsonb(old);
  posted boolean;
  totals record;
  row_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode = '23514';
  end if;
  if app_private.organization_restore_active(row_org) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'FINANCE_DRAFT_REQUIRED' using errcode = '42501'; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text || ':' || source_kind || ':' || old.id::text, 0));
  select exists(
    select 1 from public.accounting_entries
    where organization_id = old.organization_id
      and source_document_type = source_kind
      and source_document_id = old.id
      and status = 'posted'
  ) into posted;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' or coalesce(old.paid_amount, 0) > 0 or posted then
      raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode = '42501';
    end if;
    return old;
  end if;
  data := to_jsonb(new);
  if (old.status <> 'draft' and new.status = 'draft') or (old.status = 'cancelled' and new.status <> 'cancelled') then
    raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode = '42501';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'cancelled') then
    execute format(
      'select count(*) n, coalesce(sum(subtotal_ht), 0) ht, coalesce(sum(discount_amount), 0) discount, coalesce(sum(tax_amount), 0) vat, coalesce(sum(total_ttc), 0) ttc from public.%I where invoice_id = $1 and organization_id = $2',
      case when tg_table_name = 'customer_invoices' then 'customer_invoice_lines' else 'supplier_invoice_lines' end
    ) into totals using old.id, old.organization_id;
    if totals.n = 0 or totals.ttc <= 0 or (new.subtotal_ht, new.discount_total, new.tax_total, new.total_ttc) is distinct from (totals.ht, totals.discount, totals.vat, totals.ttc) then
      raise exception 'FINANCE_INVALID_DOCUMENT' using errcode = '23514';
    end if;
  end if;
  if auth.uid() is not null and new.invoice_number is distinct from old.invoice_number then
    raise exception 'FINANCE_DOCUMENT_NUMBER_READ_ONLY' using errcode = '42501';
  end if;
  if (posted or coalesce(old.paid_amount, 0) > 0 or coalesce((previous->>'credit_amount')::numeric, 0) > 0)
    and (new.status = 'cancelled' or new.archived_at is distinct from old.archived_at) then
    raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode = '42501';
  end if;
  if old.status <> 'draft' and (data - array['status','payment_status','paid_amount','remaining_amount','credit_amount','notes','internal_notes','sent_at','cancelled_at','updated_at','archived_at'])
    is distinct from (previous - array['status','payment_status','paid_amount','remaining_amount','credit_amount','notes','internal_notes','sent_at','cancelled_at','updated_at','archived_at']) then
    raise exception 'FINANCE_VALIDATED_INVOICE_READ_ONLY' using errcode = '42501';
  end if;
  return new;
end;
$guard$;

revoke all on function app_private.guard_essential_invoice_change() from public, anon, authenticated;

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

create or replace function app_private.guard_essential_posted_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $guard$
declare
  source_kind text := case when tg_table_name = 'customer_payments' then 'customer_payment' else 'supplier_payment' end;
  row_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode = '23514';
  end if;
  if app_private.organization_restore_active(row_org) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text || ':' || source_kind || ':' || old.id::text, 0));
  if exists(
    select 1 from public.accounting_entries
    where organization_id = old.organization_id
      and source_document_type = source_kind
      and source_document_id = old.id
      and status = 'posted'
  ) then
    if tg_op = 'DELETE' then raise exception 'FINANCE_POSTED_PAYMENT_READ_ONLY' using errcode = '42501'; end if;
    if new.status not in ('confirmed','partially_allocated','allocated')
      or (to_jsonb(new) - array['allocated_amount','available_amount','status','updated_at','notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date'])
        is distinct from (to_jsonb(old) - array['allocated_amount','available_amount','status','updated_at','notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date']) then
      raise exception 'FINANCE_POSTED_PAYMENT_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$guard$;

revoke all on function app_private.guard_essential_posted_payment() from public, anon, authenticated;

create or replace function app_private.guard_essential_posted_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $guard$
declare
  parent_status text;
  row_org uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'FINANCE_RELATED_RECORD_INVALID' using errcode = '23514';
  end if;
  if app_private.organization_restore_active(row_org) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'accounting_entries' then
    if old.status = 'posted' then
      if tg_op = 'DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501'; end if;
      if (to_jsonb(new) - array['label','reference','notes','updated_at'])
        is distinct from (to_jsonb(old) - array['label','reference','notes','updated_at']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501';
      end if;
    end if;
  else
    select status into parent_status from public.accounting_entries where id = (to_jsonb(old)->>'entry_id')::uuid;
    if parent_status = 'posted' then
      if tg_op = 'DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501'; end if;
      if (to_jsonb(new) - array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date'])
        is distinct from (to_jsonb(old) - array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$guard$;

revoke all on function app_private.guard_essential_posted_entry() from public, anon, authenticated;

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
    'company_settings','third_parties','products','customer_invoices','customer_invoice_lines',
    'customer_payments','supplier_invoices','supplier_invoice_lines','supplier_payments',
    'supplier_invoice_attachments','accounting_entries','accounting_entry_lines',
    'treasury_accounts','treasury_movements','hr_employees'
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

  if p_mode = 'replace' then
    for idx in reverse coalesce(array_length(allowed, 1), 0)..1 loop
      v_table := allowed[idx];
      if not (v_table = any (present)) or to_regclass('public.' || v_table) is null then
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

comment on function public.restore_organization_backup(uuid, text, jsonb) is
  'Admin restore of one organization. Generated columns are omitted. Validated invoices are inserted only while the private restore marker is set.';

select
  to_regprocedure('public.restore_organization_backup(uuid,text,jsonb)') is not null
  and to_regprocedure('app_private.organization_restore_active(uuid)') is not null
  and has_function_privilege('anon', 'public.restore_organization_backup(uuid,text,jsonb)', 'execute') = false
  and has_table_privilege('anon', 'app_private.organization_restore_scope', 'insert') = false
  as restauration_147_active;
