-- 141: manual partial and grouped bank reconciliation.
-- Apply after 140. Additive. Existing statement lines, payments and events are untouched.
-- Rollback: supabase/rollbacks/141_bank_manual_matches_rollback.sql

create table if not exists public.bank_manual_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id) on delete cascade,
  kind text not null,
  is_partial boolean not null default false,
  status text not null default 'confirmed',
  total_amount numeric(14,2) not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid,
  constraint bank_manual_matches_kind_check check (kind in ('partial', 'grouped')),
  constraint bank_manual_matches_status_check check (status in ('confirmed', 'cancelled')),
  constraint bank_manual_matches_total_check check (total_amount > 0)
);

create table if not exists public.bank_manual_match_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  match_id uuid not null references public.bank_manual_matches(id) on delete cascade,
  statement_line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  amount numeric(14,2) not null,
  constraint bank_manual_match_lines_amount_check check (amount > 0),
  unique (match_id, statement_line_id)
);

create table if not exists public.bank_manual_match_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  match_id uuid not null references public.bank_manual_matches(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  amount numeric(14,2) not null,
  constraint bank_manual_match_documents_type_check check (target_type in ('transaction', 'customer_invoice', 'supplier_invoice')),
  constraint bank_manual_match_documents_amount_check check (amount > 0),
  unique (match_id, target_type, target_id)
);

create index if not exists bank_manual_matches_account_idx
  on public.bank_manual_matches (organization_id, treasury_account_id, status, created_at desc);
create index if not exists bank_manual_match_lines_line_idx
  on public.bank_manual_match_lines (organization_id, statement_line_id);
create index if not exists bank_manual_match_documents_target_idx
  on public.bank_manual_match_documents (organization_id, target_type, target_id);

comment on table public.bank_manual_matches is
  'Rapprochement manuel partiel ou groupé saisi depuis l''écran. L''annulation passe le statut à cancelled.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bank_manual_matches', 'bank_manual_match_lines', 'bank_manual_match_documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app_private.has_active_org_membership(organization_id))',
      table_name || '_select', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id)) with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))',
      table_name || '_write', table_name
    );
    execute format('drop policy if exists pro_read_guard_110 on public.%I', table_name);
    execute format(
      'create policy pro_read_guard_110 on public.%I as restrictive for select to authenticated using (app_private.can_read_pro_erp_110(organization_id))',
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('drop trigger if exists aa_pro_member_write on public.%I', table_name);
    execute format(
      'create trigger aa_pro_member_write before insert or update or delete on public.%I for each row execute function app_private.guard_pro_member_write()',
      table_name
    );
  end loop;
end $$;

create or replace function public.save_bank_manual_match(
  p_organization_id uuid,
  p_treasury_account_id uuid,
  p_lines jsonb,
  p_documents jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  v_match uuid := gen_random_uuid();
  item jsonb;
  line_count integer := 0;
  document_count integer := 0;
  line_sum numeric(14,2) := 0;
  document_sum numeric(14,2) := 0;
  direction text;
  line_amount numeric(14,2);
  open_amount numeric(14,2);
  already numeric(14,2);
  doc_amount numeric(14,2);
  doc_direction text;
  kind text;
  partial boolean := false;
  first_line uuid;
begin
  if actor is null or not app_private.has_active_org_membership(p_organization_id) then
    raise exception 'MANUAL_MATCH_FORBIDDEN' using errcode = '42501';
  end if;
  if app_private.is_read_only_org_member(p_organization_id) or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'MANUAL_MATCH_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_typeof(p_documents) <> 'array'
    or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_documents) = 0 then
    raise exception 'MANUAL_MATCH_EMPTY' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_lines))
    <> (select count(distinct value->>'id') from jsonb_array_elements(p_lines))
    or (select count(*) from jsonb_array_elements(p_documents))
    <> (select count(distinct (value->>'type') || ':' || (value->>'id')) from jsonb_array_elements(p_documents)) then
    raise exception 'MANUAL_MATCH_DUPLICATE' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_lines) loop
    line_amount := null;
    doc_direction := null;
    select amount, direction into line_amount, doc_direction
    from public.bank_statement_lines
    where id = (item->>'id')::uuid
      and organization_id = p_organization_id
      and treasury_account_id = p_treasury_account_id
      and reconciliation_status = 'unreconciled';
    if not found or line_amount is null then
      raise exception 'MANUAL_MATCH_LINE' using errcode = '22023';
    end if;
    if direction is null then direction := doc_direction;
    elsif direction <> doc_direction then
      raise exception 'MANUAL_MATCH_DIRECTION' using errcode = '22023';
    end if;
    select coalesce(sum(l.amount), 0) into already
    from public.bank_manual_match_lines l
    join public.bank_manual_matches m on m.id = l.match_id
    where l.statement_line_id = (item->>'id')::uuid
      and m.organization_id = p_organization_id
      and m.status = 'confirmed';
    open_amount := round(line_amount - already, 2);
    line_amount := round((item->>'amount')::numeric, 2);
    if line_amount <= 0 or line_amount > open_amount + 0.001 then
      raise exception 'MANUAL_MATCH_AMOUNT' using errcode = '22023';
    end if;
    if line_amount + 0.009 < open_amount then partial := true; end if;
    line_sum := line_sum + line_amount;
    line_count := line_count + 1;
    if first_line is null then first_line := (item->>'id')::uuid; end if;
  end loop;

  for item in select value from jsonb_array_elements(p_documents) loop
    doc_amount := round((item->>'amount')::numeric, 2);
    open_amount := null;
    doc_direction := null;
    if item->>'type' = 'customer_invoice' then
      if direction <> 'in' then raise exception 'MANUAL_MATCH_DIRECTION' using errcode = '22023'; end if;
      select round(remaining_amount, 2) into open_amount
      from public.customer_invoices
      where id = (item->>'id')::uuid and organization_id = p_organization_id
        and archived_at is null and status not in ('draft', 'cancelled');
    elsif item->>'type' = 'supplier_invoice' then
      if direction <> 'out' then raise exception 'MANUAL_MATCH_DIRECTION' using errcode = '22023'; end if;
      select round(remaining_amount, 2) into open_amount
      from public.supplier_invoices
      where id = (item->>'id')::uuid and organization_id = p_organization_id
        and archived_at is null and status in ('validated', 'partially_paid');
    elsif item->>'type' = 'transaction' then
      select round(amount, 2), direction into open_amount, doc_direction
      from public.treasury_transactions
      where id = (item->>'id')::uuid and organization_id = p_organization_id
        and treasury_account_id = p_treasury_account_id
        and archived_at is null and reconciliation_status = 'unreconciled';
      if not found then raise exception 'MANUAL_MATCH_DOCUMENT' using errcode = '22023'; end if;
      if doc_direction is distinct from direction then
        raise exception 'MANUAL_MATCH_DIRECTION' using errcode = '22023';
      end if;
    else
      raise exception 'MANUAL_MATCH_DOCUMENT' using errcode = '22023';
    end if;
    if not found or open_amount is null then raise exception 'MANUAL_MATCH_DOCUMENT' using errcode = '22023'; end if;
    select coalesce(sum(d.amount), 0) into already
    from public.bank_manual_match_documents d
    join public.bank_manual_matches m on m.id = d.match_id
    where d.target_id = (item->>'id')::uuid and d.target_type = item->>'type'
      and m.organization_id = p_organization_id and m.status = 'confirmed';
    open_amount := round(open_amount - already, 2);
    if doc_amount <= 0 or doc_amount > open_amount + 0.001 then
      raise exception 'MANUAL_MATCH_AMOUNT' using errcode = '22023';
    end if;
    if doc_amount + 0.009 < open_amount then partial := true; end if;
    document_sum := document_sum + doc_amount;
    document_count := document_count + 1;
  end loop;

  if abs(line_sum - document_sum) > 0.009 then
    raise exception 'MANUAL_MATCH_BALANCE' using errcode = '22023';
  end if;
  kind := case when line_count > 1 or document_count > 1 then 'grouped' else 'partial' end;

  insert into public.bank_manual_matches (
    id, organization_id, treasury_account_id, kind, is_partial, status, total_amount, created_by
  ) values (
    v_match, p_organization_id, p_treasury_account_id, kind, partial, 'confirmed', round(line_sum, 2), actor
  );
  insert into public.bank_manual_match_lines (organization_id, match_id, statement_line_id, amount)
  select p_organization_id, v_match, (value->>'id')::uuid, round((value->>'amount')::numeric, 2)
  from jsonb_array_elements(p_lines);
  insert into public.bank_manual_match_documents (organization_id, match_id, target_type, target_id, amount)
  select p_organization_id, v_match, value->>'type', (value->>'id')::uuid, round((value->>'amount')::numeric, 2)
  from jsonb_array_elements(p_documents);

  update public.bank_statement_lines line
  set reconciliation_status = 'reconciled',
      matched_at = now(),
      matched_by = actor,
      match_reason = 'Rapprochement manuel'
  where line.organization_id = p_organization_id
    and line.id in (select statement_line_id from public.bank_manual_match_lines where match_id = v_match)
    and line.amount <= (
      select coalesce(sum(l.amount), 0) + 0.009
      from public.bank_manual_match_lines l
      join public.bank_manual_matches m on m.id = l.match_id
      where l.statement_line_id = line.id and m.status = 'confirmed' and m.organization_id = p_organization_id
    );
  update public.treasury_transactions tx
  set reconciliation_status = 'reconciled', reconciled_at = now(), reconciled_by = actor
  where tx.organization_id = p_organization_id
    and tx.id in (
      select target_id from public.bank_manual_match_documents
      where match_id = v_match and target_type = 'transaction'
    )
    and tx.amount <= (
      select coalesce(sum(d.amount), 0) + 0.009
      from public.bank_manual_match_documents d
      join public.bank_manual_matches m on m.id = d.match_id
      where d.target_id = tx.id and d.target_type = 'transaction'
        and m.status = 'confirmed' and m.organization_id = p_organization_id
    );

  insert into public.bank_reconciliation_events (
    organization_id, treasury_account_id, statement_line_id, action, reason, payload, created_by
  ) values (
    p_organization_id,
    p_treasury_account_id,
    first_line,
    case when kind = 'grouped' then 'manual_grouped' else 'manual' end,
    case when kind = 'grouped' then 'Rapprochement groupé' else 'Rapprochement partiel' end,
    jsonb_build_object('matchId', v_match, 'partial', partial, 'total', round(line_sum, 2)),
    actor
  );
  return v_match;
end;
$$;

create or replace function public.undo_bank_manual_match(p_organization_id uuid, p_match_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  current_status text;
  account_id uuid;
  first_line uuid;
begin
  if actor is null or not app_private.has_active_org_membership(p_organization_id) then
    raise exception 'MANUAL_MATCH_FORBIDDEN' using errcode = '42501';
  end if;
  if app_private.is_read_only_org_member(p_organization_id) or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'MANUAL_MATCH_FORBIDDEN' using errcode = '42501';
  end if;
  select status, treasury_account_id into current_status, account_id
  from public.bank_manual_matches
  where id = p_match_id and organization_id = p_organization_id
  for update;
  if current_status is null then
    raise exception 'MANUAL_MATCH_MISSING' using errcode = '22023';
  end if;
  if current_status = 'cancelled' then
    return;
  end if;
  update public.bank_manual_matches
  set status = 'cancelled', cancelled_at = now(), cancelled_by = actor
  where id = p_match_id and organization_id = p_organization_id and status = 'confirmed';

  update public.bank_statement_lines line
  set reconciliation_status = 'unreconciled',
      matched_transaction_id = null,
      matched_at = null,
      matched_by = null,
      match_score = null,
      match_reason = null
  where line.organization_id = p_organization_id
    and line.id in (select statement_line_id from public.bank_manual_match_lines where match_id = p_match_id)
    and line.amount > (
      select coalesce(sum(l.amount), 0) + 0.009
      from public.bank_manual_match_lines l
      join public.bank_manual_matches m on m.id = l.match_id
      where l.statement_line_id = line.id and m.status = 'confirmed' and m.organization_id = p_organization_id
    );
  update public.treasury_transactions tx
  set reconciliation_status = 'unreconciled', reconciled_at = null, reconciled_by = null
  where tx.organization_id = p_organization_id
    and tx.id in (
      select target_id from public.bank_manual_match_documents
      where match_id = p_match_id and target_type = 'transaction'
    )
    and tx.amount > (
      select coalesce(sum(d.amount), 0) + 0.009
      from public.bank_manual_match_documents d
      join public.bank_manual_matches m on m.id = d.match_id
      where d.target_id = tx.id and d.target_type = 'transaction'
        and m.status = 'confirmed' and m.organization_id = p_organization_id
    );

  select statement_line_id into first_line
  from public.bank_manual_match_lines where match_id = p_match_id limit 1;
  insert into public.bank_reconciliation_events (
    organization_id, treasury_account_id, statement_line_id, action, reason, payload, created_by
  ) values (
    p_organization_id, account_id, first_line, 'undone', 'Annulation du rapprochement manuel',
    jsonb_build_object('matchId', p_match_id), actor
  );
end;
$$;

revoke all on function public.save_bank_manual_match(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.undo_bank_manual_match(uuid, uuid) from public, anon;
grant execute on function public.save_bank_manual_match(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.undo_bank_manual_match(uuid, uuid) to authenticated;
