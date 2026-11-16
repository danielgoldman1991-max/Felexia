-- 151: before a replace or a purge, clear foreign keys that point at the rows
-- being removed and do not cascade. The posted-entry guard is not changed.
-- A purge or a replace also requires the same confirmation as the screen.
-- Not applied here.
-- Rollback: supabase/rollbacks/151_restore_fk_order_rollback.sql

create or replace function app_private.restore_detach_inbound_fks(
  p_organization_id uuid,
  p_table text,
  p_ids uuid[],
  p_depth integer default 0
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $detach$
declare
  ref record;
  has_org boolean;
  has_id boolean;
  ref_ids uuid[];
begin
  if p_depth > 8 or p_ids is null or cardinality(p_ids) = 0 or to_regclass('public.' || p_table) is null then
    return;
  end if;
  for ref in
    select
      src.oid as src_oid,
      src.relname as src_table,
      att.attname as src_column,
      att.attnotnull as src_not_null,
      att.attgenerated <> '' as src_generated
    from pg_constraint constraint_row
    join pg_class src on src.oid = constraint_row.conrelid
    join pg_namespace src_schema on src_schema.oid = src.relnamespace
    join pg_attribute att on att.attrelid = constraint_row.conrelid and att.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = to_regclass('public.' || p_table)
      and src_schema.nspname = 'public'
      and constraint_row.confdeltype in ('a', 'r')
      and cardinality(constraint_row.conkey) = 1
  loop
    select exists (
      select 1 from pg_attribute column_row
      where column_row.attrelid = ref.src_oid and column_row.attname = 'organization_id' and column_row.attnum > 0 and not column_row.attisdropped
    ), exists (
      select 1 from pg_attribute column_row
      where column_row.attrelid = ref.src_oid and column_row.attname = 'id' and column_row.attnum > 0 and not column_row.attisdropped
    )
    into has_org, has_id;
    -- Issued archives cannot be deleted (append-only). Leaving the row makes
    -- the invoice delete fail with the foreign key, instead of destroying it.
    if ref.src_table like 'einvoice_%' then
      continue;
    end if;
    if ref.src_generated or ref.src_not_null then
      if has_id then
        if has_org then
          execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column)
            into ref_ids using p_organization_id, p_ids;
        else
          execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where %I = any($1)', ref.src_table, ref.src_column)
            into ref_ids using p_ids;
        end if;
        perform app_private.restore_detach_inbound_fks(p_organization_id, ref.src_table, ref_ids, p_depth + 1);
      end if;
      if has_org then
        execute format('delete from public.%I where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column)
          using p_organization_id, p_ids;
      else
        execute format('delete from public.%I where %I = any($1)', ref.src_table, ref.src_column)
          using p_ids;
      end if;
    else
      if has_org then
        execute format('update public.%I set %I = null where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column, ref.src_column)
          using p_organization_id, p_ids;
      else
        execute format('update public.%I set %I = null where %I = any($1)', ref.src_table, ref.src_column, ref.src_column)
          using p_ids;
      end if;
    end if;
  end loop;
end;
$detach$;

revoke all on function app_private.restore_detach_inbound_fks(uuid, text, uuid[], integer) from public, anon, authenticated;

drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[]);

create or replace function public.restore_organization_backup_bundle(
  p_organization_id uuid,
  p_mode text,
  p_parent text,
  p_parents jsonb,
  p_child text,
  p_child_key text,
  p_children jsonb,
  p_keep_ids uuid[] default '{}'::uuid[],
  p_confirm text default null,
  p_confirm_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $bundle$
declare
  parents text[] := array[
    'company_settings','product_categories','units','tax_rates','accounting_journals','accounting_accounts',
    'third_parties','third_party_contacts','third_party_addresses','products',
    'customer_invoices','customer_credit_notes','customer_payments','customer_credit_note_applications',
    'supplier_invoices','supplier_invoice_attachments','supplier_credit_notes','supplier_payments',
    'supplier_credit_note_applications','treasury_accounts','treasury_transactions',
    'accounting_entries','hr_departments','hr_positions','hr_employees'
  ];
  children text[] := array[
    'customer_invoice_lines','supplier_invoice_lines','customer_credit_note_lines','supplier_credit_note_lines',
    'customer_payment_allocations','supplier_payment_allocations','accounting_entry_lines'
  ];
  keys text[] := array['entry_id','invoice_id','credit_note_id','payment_id'];
  parent_ids uuid[];
  child_ids uuid[];
  organization_name text;
  caught_message text;
begin
  if p_mode not in ('merge', 'replace', 'rehearse', 'purge') then
    raise exception 'RESTORE_MODE' using errcode = '22023';
  end if;
  if not (p_parent = any (parents)) or (p_child is not null and not (p_child = any (children))) or (p_child is not null and not (p_child_key = any (keys))) then
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
  if p_mode in ('purge', 'replace') then
    select organization_row.name into organization_name from public.organizations organization_row where organization_row.id = p_organization_id;
    if p_confirm is distinct from 'oui' or p_confirm_name is distinct from organization_name then
      raise exception 'RESTORE_CONFIRMATION' using errcode = '42501';
    end if;
  end if;

  if p_mode = 'rehearse' then
    begin
      perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_parent, coalesce(p_parents, '[]'::jsonb), '{}'::uuid[]);
      if p_child is not null then
        perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_child, coalesce(p_children, '[]'::jsonb), '{}'::uuid[]);
      end if;
      set constraints all immediate;
      raise exception 'RESTORE_REHEARSE' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then
        if sqlerrm = 'RESTORE_REHEARSE' then
          return jsonb_build_object('ok', true, 'rehearsed', true, 'written', 0);
        end if;
        raise;
    end;
  end if;

  insert into app_private.organization_restore_scope(txid, organization_id)
  values (txid_current(), p_organization_id)
  on conflict (txid) do update set organization_id = excluded.organization_id;

  begin
    if p_mode = 'purge' then
      if p_child is not null then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and not (%I = any($2))', p_child, p_child_key)
          into child_ids using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_child, child_ids, 0);
        execute format('delete from public.%I where organization_id = $1 and not (%I = any($2))', p_child, p_child_key)
          using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
      end if;
      if p_parent <> 'company_settings' then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and not (id = any($2))', p_parent)
          into parent_ids using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_parent, parent_ids, 0);
        execute format('delete from public.%I where organization_id = $1 and not (id = any($2))', p_parent)
          using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
      end if;
    elsif p_mode = 'replace' then
      select coalesce(array_agg((elem->>'id')::uuid), '{}'::uuid[]) into parent_ids
      from jsonb_array_elements(coalesce(p_parents, '[]'::jsonb)) elem
      where elem->>'id' is not null;
      if p_child is not null then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and %I = any($2)', p_child, p_child_key)
          into child_ids using p_organization_id, parent_ids;
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_child, child_ids, 0);
        execute format('delete from public.%I where organization_id = $1 and %I = any($2)', p_child, p_child_key)
          using p_organization_id, parent_ids;
      end if;
      perform app_private.restore_detach_inbound_fks(p_organization_id, p_parent, parent_ids, 0);
      execute format('delete from public.%I where organization_id = $1 and id = any($2)', p_parent)
        using p_organization_id, parent_ids;
    end if;

    if p_mode in ('merge', 'replace') then
      perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_parent, coalesce(p_parents, '[]'::jsonb), '{}'::uuid[]);
      if p_child is not null then
        perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_child, coalesce(p_children, '[]'::jsonb), '{}'::uuid[]);
      end if;
    end if;

    delete from app_private.organization_restore_scope where txid = txid_current();
    return jsonb_build_object('ok', true, 'written', coalesce(jsonb_array_length(p_parents), 0) + coalesce(jsonb_array_length(p_children), 0));
  exception when others then
    caught_message := sqlerrm;
    begin
      delete from app_private.organization_restore_scope where txid = txid_current();
    exception when others then
      null;
    end;
    if caught_message like 'RESTORE_%' or caught_message like 'FINANCE_%' or caught_message like 'CREDIT_%' or caught_message like 'EINVOICE_%' then
      raise;
    end if;
    raise exception 'RESTORE_BLOCKED|%|%', p_parent, sqlstate using errcode = 'P0001';
  end;
end;
$bundle$;

revoke all on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text) to authenticated;
