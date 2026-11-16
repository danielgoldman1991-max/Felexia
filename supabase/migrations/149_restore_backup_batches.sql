-- 149: restore one table, or one batch of rows, per call.
-- Each call stays inside the authenticated statement timeout. The bypass marker
-- is removed before the call returns, including when the call fails.
-- Not applied by the application. Rollback: supabase/rollbacks/149_restore_backup_batches_rollback.sql

create or replace function public.restore_organization_backup_batch(
  p_organization_id uuid,
  p_mode text,
  p_table text,
  p_rows jsonb default '[]'::jsonb,
  p_fresh_invoice_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $batch$
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
  v_plan text;
  conflict_column text;
  prepared jsonb;
  classified jsonb;
  item jsonb;
  existing jsonb;
  incoming jsonb;
  source jsonb;
  ignore_cols text[];
  writable text[];
  insert_rows jsonb := '[]'::jsonb;
  update_rows jsonb := '[]'::jsonb;
  safe_rows jsonb := '[]'::jsonb;
  insert_cols text;
  select_cols text;
  assignment text;
  safe_assignment text;
  written integer := 0;
  skipped integer := 0;
  batch_written integer;
  inserted uuid[] := '{}'::uuid[];
  parents jsonb := '{}'::jsonb;
  parent_table text;
  parent jsonb;
  row_key uuid;
  caught_state text;
  caught_message text;
begin
  if p_mode not in ('merge', 'delete') then
    raise exception 'RESTORE_MODE' using errcode = '22023';
  end if;
  if p_table <> all (allowed) and not (p_table = any (allowed)) then
    raise exception 'RESTORE_TABLE_FORBIDDEN' using errcode = '42501';
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
  if to_regclass('public.' || p_table) is null then
    return jsonb_build_object('name', p_table, 'written', 0, 'skipped', 0, 'insertedInvoiceIds', '[]'::jsonb, 'missing', true);
  end if;

  select subscription.plan_code into v_plan
  from public.organization_subscriptions subscription
  where subscription.organization_id = p_organization_id
  order by subscription.created_at desc nulls last
  limit 1;
  if p_table like 'hr\_%' escape '\' and v_plan is not null and lower(v_plan) not in ('premium', 'pro') then
    return jsonb_build_object('name', p_table, 'written', 0, 'skipped', 0, 'insertedInvoiceIds', '[]'::jsonb, 'omitted', 'PRO_REQUIRED');
  end if;

  insert into app_private.organization_restore_scope(txid, organization_id)
  values (txid_current(), p_organization_id)
  on conflict (txid) do update set organization_id = excluded.organization_id;

  begin
    if p_mode = 'delete' then
      execute format(
        'with doomed as (select ctid from public.%1$I where organization_id = $1 limit 400) delete from public.%1$I target using doomed where target.ctid = doomed.ctid',
        p_table
      ) using p_organization_id;
      get diagnostics written = row_count;
      delete from app_private.organization_restore_scope where txid = txid_current();
      return jsonb_build_object('name', p_table, 'written', written, 'skipped', 0, 'insertedInvoiceIds', '[]'::jsonb);
    end if;

    if jsonb_typeof(p_rows) is distinct from 'array' then
      raise exception 'RESTORE_PAYLOAD' using errcode = '22023';
    end if;
    if jsonb_array_length(p_rows) > 400 then
      raise exception 'RESTORE_BATCH' using errcode = '22023';
    end if;
    if jsonb_array_length(p_rows) = 0 then
      delete from app_private.organization_restore_scope where txid = txid_current();
      return jsonb_build_object('name', p_table, 'written', 0, 'skipped', 0, 'insertedInvoiceIds', '[]'::jsonb);
    end if;

    select coalesce(jsonb_agg(elem || jsonb_build_object('organization_id', p_organization_id)), '[]'::jsonb)
      into prepared
    from jsonb_array_elements(p_rows) elem;

    conflict_column := case when p_table = 'company_settings' then 'organization_id' else 'id' end;
    select
      coalesce(array_agg(attname::text) filter (where attgenerated = '' and attidentity is distinct from 'a'), '{}'),
      coalesce(array_agg(attname::text) filter (
        where attgenerated <> ''
          or attname = any (array['updated_at', 'created_at'])
          or attname::text <> all (select jsonb_object_keys(prepared->0))
      ), '{}')
      into writable, ignore_cols
    from pg_attribute
    where attrelid = to_regclass('public.' || p_table)
      and attnum > 0
      and not attisdropped;

    if p_table in ('customer_invoice_lines', 'supplier_invoice_lines') then
      parent_table := case when p_table = 'customer_invoice_lines' then 'customer_invoices' else 'supplier_invoices' end;
      execute format(
        'select coalesce(jsonb_object_agg(id::text, jsonb_build_object(''organization_id'', organization_id, ''status'', status)), ''{}''::jsonb) from public.%I where id = any($1)',
        parent_table
      ) into parents using (
        select coalesce(array_agg(distinct (elem->>'invoice_id')::uuid), '{}'::uuid[])
        from jsonb_array_elements(prepared) elem
        where elem->>'invoice_id' is not null
      );
    end if;

    execute format($sql$
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', rec.%2$I,
        'incoming', to_jsonb(rec),
        'existing', existing.doc,
        'source', elem
      )), '[]'::jsonb)
      from jsonb_array_elements($1) elem
      cross join lateral jsonb_populate_record(null::public.%1$I, elem) rec
      left join lateral (
        select to_jsonb(found_row) as doc
        from public.%1$I found_row
        where found_row.%2$I = rec.%2$I
      ) existing on true
    $sql$, p_table, conflict_column)
    into classified
    using prepared;

    for item in select value from jsonb_array_elements(classified) loop
      source := item->'source';
      incoming := item->'incoming';
      existing := item->'existing';
      row_key := nullif(item->>'key', '')::uuid;
      if row_key is null then
        raise exception 'RESTORE_ROW_KEY' using errcode = '22023';
      end if;
      if existing is null or jsonb_typeof(existing) is distinct from 'object' then
        insert_rows := insert_rows || jsonb_build_array(source);
        continue;
      end if;
      if nullif(existing->>'organization_id', '')::uuid is distinct from p_organization_id then
        skipped := skipped + 1;
        continue;
      end if;
      if p_table in ('customer_invoice_lines', 'supplier_invoice_lines') then
        parent := parents -> nullif(source->>'invoice_id', '');
        if parent is not null and nullif(parent->>'organization_id', '')::uuid is distinct from p_organization_id then
          skipped := skipped + 1;
          continue;
        end if;
        if parent is not null
          and parent->>'status' is distinct from 'draft'
          and not (nullif(source->>'invoice_id', '')::uuid = any (p_fresh_invoice_ids)) then
          skipped := skipped + 1;
          continue;
        end if;
      end if;
      if existing is not null and (existing - ignore_cols) = (incoming - ignore_cols) then
        skipped := skipped + 1;
        continue;
      end if;
      if existing is null then
        insert_rows := insert_rows || jsonb_build_array(source);
      elsif p_table in ('customer_invoices', 'supplier_invoices') and existing->>'status' is distinct from 'draft' then
        safe_rows := safe_rows || jsonb_build_array(source);
      else
        update_rows := update_rows || jsonb_build_array(source);
      end if;
    end loop;

    if jsonb_array_length(insert_rows) > 0 then
      select
        coalesce(string_agg(format('%I', name), ', ' order by ord), ''),
        coalesce(string_agg(format('rec.%I', name), ', ' order by ord), '')
      into insert_cols, select_cols
      from unnest(writable) with ordinality as names(name, ord)
      where exists (select 1 from jsonb_object_keys(insert_rows->0) as json_key where json_key = names.name);
      if p_table in ('customer_invoices', 'supplier_invoices') then
        for row_key in execute format(
          'insert into public.%1$I (%2$s) select %3$s from jsonb_array_elements($1) elem cross join lateral jsonb_populate_record(null::public.%1$I, elem) rec returning id',
          p_table, insert_cols, select_cols
        ) using insert_rows loop
          inserted := inserted || row_key;
          written := written + 1;
        end loop;
      else
        execute format(
          'insert into public.%1$I (%2$s) select %3$s from jsonb_array_elements($1) elem cross join lateral jsonb_populate_record(null::public.%1$I, elem) rec',
          p_table, insert_cols, select_cols
        ) using insert_rows;
        get diagnostics batch_written = row_count;
        written := written + batch_written;
      end if;
    end if;

    if jsonb_array_length(update_rows) > 0 then
      select coalesce(string_agg(format('%1$I = rec.%1$I', name), ', ' order by ord), '')
        into assignment
      from unnest(writable) with ordinality as names(name, ord)
      where name <> conflict_column
        and not (p_table in ('customer_invoices', 'supplier_invoices') and name = 'invoice_number')
        and exists (select 1 from jsonb_object_keys(update_rows->0) as json_key where json_key = names.name);
      if assignment <> '' then
        execute format(
          'update public.%1$I as target set %2$s from jsonb_array_elements($1) elem cross join lateral jsonb_populate_record(null::public.%1$I, elem) rec where target.%3$I = rec.%3$I and target.organization_id = $2',
          p_table, assignment, conflict_column
        ) using update_rows, p_organization_id;
        get diagnostics batch_written = row_count;
        written := written + batch_written;
      else
        skipped := skipped + jsonb_array_length(update_rows);
      end if;
    end if;

    if jsonb_array_length(safe_rows) > 0 then
      select coalesce(string_agg(format('%1$I = rec.%1$I', name), ', ' order by ord), '')
        into safe_assignment
      from unnest(invoice_safe) with ordinality as names(name, ord)
      where name = any (writable)
        and exists (select 1 from jsonb_object_keys(safe_rows->0) as json_key where json_key = names.name);
      if safe_assignment <> '' then
        execute format(
          'update public.%1$I as target set %2$s from jsonb_array_elements($1) elem cross join lateral jsonb_populate_record(null::public.%1$I, elem) rec where target.%3$I = rec.%3$I and target.organization_id = $2',
          p_table, safe_assignment, conflict_column
        ) using safe_rows, p_organization_id;
        get diagnostics batch_written = row_count;
        written := written + batch_written;
      else
        skipped := skipped + jsonb_array_length(safe_rows);
      end if;
    end if;

    delete from app_private.organization_restore_scope where txid = txid_current();
    return jsonb_build_object(
      'name', p_table,
      'written', written,
      'skipped', skipped,
      'insertedInvoiceIds', to_jsonb(inserted)
    );
  exception when others then
    caught_state := sqlstate;
    caught_message := sqlerrm;
    begin
      delete from app_private.organization_restore_scope where txid = txid_current();
    exception when others then
      null;
    end;
    if caught_message like 'RESTORE_%' then
      raise;
    end if;
    raise exception 'RESTORE_BLOCKED|%|%', p_table, coalesce(caught_state, 'P0001') using errcode = 'P0001';
  end;
end;
$batch$;

revoke all on function public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[]) to authenticated;
