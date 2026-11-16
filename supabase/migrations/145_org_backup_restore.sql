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
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = p_organization_id
      and status = 'active'
      and role in ('owner', 'admin')
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
