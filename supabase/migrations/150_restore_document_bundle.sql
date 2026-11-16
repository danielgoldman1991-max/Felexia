-- 150: restore a document with its lines in one transaction.
-- The posted-entry guard stays the one from migration 147: lettering remains
-- allowed, an organization change stays refused, and restore already bypasses
-- that guard. This file does not replace it.
-- Not applied here.
-- Rollback: supabase/rollbacks/150_restore_document_bundle_rollback.sql

create or replace function public.restore_organization_backup_bundle(
  p_organization_id uuid,
  p_mode text,
  p_parent text,
  p_parents jsonb,
  p_child text,
  p_child_key text,
  p_children jsonb,
  p_keep_ids uuid[] default '{}'::uuid[]
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
        execute format('delete from public.%I where organization_id = $1 and not (%I = any($2))', p_child, p_child_key)
          using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
      end if;
      if p_parent <> 'company_settings' then
        execute format('delete from public.%I where organization_id = $1 and not (id = any($2))', p_parent)
          using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
      end if;
    elsif p_mode = 'replace' then
      select coalesce(array_agg((elem->>'id')::uuid), '{}'::uuid[]) into parent_ids
      from jsonb_array_elements(coalesce(p_parents, '[]'::jsonb)) elem
      where elem->>'id' is not null;
      if p_child is not null then
        execute format('delete from public.%I where organization_id = $1 and %I = any($2)', p_child, p_child_key)
          using p_organization_id, parent_ids;
      end if;
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
    if caught_message like 'RESTORE_%' or caught_message like 'FINANCE_%' or caught_message like 'CREDIT_%' then
      raise;
    end if;
    raise exception 'RESTORE_BLOCKED|%|%', p_parent, sqlstate using errcode = 'P0001';
  end;
end;
$bundle$;

revoke all on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[]) to authenticated;
