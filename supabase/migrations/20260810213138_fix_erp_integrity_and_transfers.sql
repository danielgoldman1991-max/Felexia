-- Felexia ERP integrity repair.
-- Keeps payment allocations, invoice balances, stock history, linked documents,
-- and two-account treasury transfers consistent at the database boundary.

-- ---------------------------------------------------------------------------
-- Atomic treasury transfers
-- ---------------------------------------------------------------------------
alter table public.treasury_transactions
  add column if not exists transfer_group_id uuid null,
  add column if not exists idempotency_key uuid null;

create index if not exists treasury_transactions_transfer_group_id_idx
  on public.treasury_transactions (organization_id, transfer_group_id)
  where transfer_group_id is not null;

create unique index if not exists treasury_transactions_org_idempotency_unique
  on public.treasury_transactions (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists treasury_transfer_group_direction_unique
  on public.treasury_transactions (organization_id, transfer_group_id, direction)
  where transfer_group_id is not null and archived_at is null;

create or replace function public.apply_treasury_transaction_balance_delta()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_delta numeric(14,2) := 0;
  v_new_delta numeric(14,2) := 0;
begin
  -- Lock all affected accounts in a deterministic order before applying deltas.
  perform account.id
  from public.treasury_accounts account
  where account.id in (
    case when tg_op in ('UPDATE', 'DELETE') then old.treasury_account_id else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.treasury_account_id else null end
  )
  order by account.id
  for update;

  if tg_op in ('UPDATE', 'DELETE') and old.archived_at is null then
    v_old_delta := case
      when old.transaction_type = 'opening_balance' then 0
      when old.direction = 'out' then -old.amount
      else old.amount
    end;
    update public.treasury_accounts
    set current_balance = current_balance - v_old_delta, updated_at = now()
    where id = old.treasury_account_id and organization_id = old.organization_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.archived_at is null then
    v_new_delta := case
      when new.transaction_type = 'opening_balance' then 0
      when new.direction = 'out' then -new.amount
      else new.amount
    end;
    update public.treasury_accounts
    set current_balance = current_balance + v_new_delta, updated_at = now()
    where id = new.treasury_account_id and organization_id = new.organization_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists treasury_transactions_sync_balance on public.treasury_transactions;
create trigger treasury_transactions_sync_balance
after insert or delete or update of treasury_account_id, organization_id, transaction_type, direction, amount, archived_at
on public.treasury_transactions
for each row execute function public.apply_treasury_transaction_balance_delta();

revoke all on function public.apply_treasury_transaction_balance_delta() from public, anon;

create or replace function public.create_treasury_transfer(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_value_date date,
  p_label text,
  p_reference text default null,
  p_description text default null,
  p_idempotency_key uuid default null
)
returns table(transfer_group_id uuid, outgoing_transaction_id uuid, incoming_transaction_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.treasury_accounts%rowtype;
  v_destination public.treasury_accounts%rowtype;
  v_group_id uuid;
  v_outgoing_id uuid;
  v_incoming_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
  if p_source_account_id is null or p_destination_account_id is null or p_source_account_id = p_destination_account_id then
    raise exception 'Les comptes source et destination doivent être différents.';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Le montant doit être supérieur à zéro.';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'Le libellé est obligatoire.';
  end if;

  if p_idempotency_key is null then
    raise exception 'Une cle d''idempotence est obligatoire.';
  end if;
  v_group_id := p_idempotency_key;

  -- Deterministic lock order prevents deadlocks for concurrent reverse transfers.
  perform id
  from public.treasury_accounts
  where id in (p_source_account_id, p_destination_account_id)
  order by id
  for update;

  select * into v_source
  from public.treasury_accounts
  where id = p_source_account_id and archived_at is null and status = 'active';

  select * into v_destination
  from public.treasury_accounts
  where id = p_destination_account_id and archived_at is null and status = 'active';

  if v_source.id is null or v_destination.id is null then
    raise exception 'Un des comptes de trésorerie est introuvable ou inactif.';
  end if;
  if v_source.organization_id <> v_destination.organization_id then
    raise exception 'Les deux comptes doivent appartenir à la même organisation.';
  end if;
  if v_source.currency <> v_destination.currency then
    raise exception 'Les deux comptes doivent utiliser la même devise.';
  end if;
  if not exists (
    select 1 from public.organization_members organization_member
    where organization_member.organization_id = v_source.organization_id
      and organization_member.user_id = auth.uid()
      and organization_member.status = 'active'
  ) then
    raise exception 'Accès refusé à cette organisation.';
  end if;

  select outgoing.id, incoming.id
    into v_outgoing_id, v_incoming_id
  from public.treasury_transactions outgoing
  join public.treasury_transactions incoming
    on incoming.organization_id = outgoing.organization_id
   and incoming.transfer_group_id = outgoing.transfer_group_id
   and incoming.direction = 'in'
   and incoming.archived_at is null
  where outgoing.organization_id = v_source.organization_id
    and outgoing.transfer_group_id = v_group_id
    and outgoing.direction = 'out'
    and outgoing.archived_at is null;
  if v_outgoing_id is not null and v_incoming_id is not null then
    return query select v_group_id, v_outgoing_id, v_incoming_id;
    return;
  end if;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    currency, transaction_date, value_date, label, reference, description,
    created_by, transfer_group_id
  ) values (
    v_source.organization_id, v_source.id, 'transfer_out', 'out', round(p_amount, 2),
    v_source.currency, coalesce(p_transaction_date, current_date), p_value_date,
    btrim(p_label), nullif(btrim(p_reference), ''), nullif(btrim(p_description), ''),
    auth.uid(), v_group_id
  ) returning id into v_outgoing_id;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    currency, transaction_date, value_date, label, reference, description,
    created_by, transfer_group_id
  ) values (
    v_destination.organization_id, v_destination.id, 'transfer_in', 'in', round(p_amount, 2),
    v_destination.currency, coalesce(p_transaction_date, current_date), p_value_date,
    btrim(p_label), nullif(btrim(p_reference), ''), nullif(btrim(p_description), ''),
    auth.uid(), v_group_id
  ) returning id into v_incoming_id;

  return query select v_group_id, v_outgoing_id, v_incoming_id;
end;
$$;

revoke all on function public.create_treasury_transfer(uuid, uuid, numeric, date, date, text, text, text, uuid) from public, anon;
grant execute on function public.create_treasury_transfer(uuid, uuid, numeric, date, date, text, text, text, uuid) to authenticated;

create or replace function public.create_treasury_transaction_atomic(
  p_organization_id uuid,
  p_treasury_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_transaction_date date,
  p_idempotency_key uuid,
  p_value_date date default null,
  p_label text default null,
  p_reference text default null,
  p_description text default null,
  p_third_party_id uuid default null
)
returns table(transaction_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if p_idempotency_key is null then raise exception 'Une cle d''idempotence est obligatoire.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Le montant doit etre positif.'; end if;
  if nullif(btrim(p_label), '') is null then raise exception 'Le libelle est obligatoire.'; end if;
  if p_transaction_type not in ('manual_in', 'manual_out', 'bank_fee', 'adjustment', 'other') then
    raise exception 'Type de mouvement manuel non autorise.';
  end if;
  if p_direction not in ('in', 'out')
     or (p_transaction_type = 'manual_in' and p_direction <> 'in')
     or (p_transaction_type in ('manual_out', 'bank_fee') and p_direction <> 'out') then
    raise exception 'Le sens du mouvement est incompatible avec son type.';
  end if;

  perform 1 from public.treasury_accounts
  where id = p_treasury_account_id and organization_id = p_organization_id
    and status = 'active' and archived_at is null
  for update;
  if not found then raise exception 'Compte de tresorerie introuvable ou inactif.'; end if;
  if not exists (
    select 1 from public.organization_members organization_member
    where organization_member.organization_id = p_organization_id
      and organization_member.user_id = auth.uid()
      and organization_member.status = 'active'
  ) then raise exception 'Acces refuse a cette organisation.'; end if;
  if p_third_party_id is not null and not exists (
    select 1 from public.third_parties
    where id = p_third_party_id and organization_id = p_organization_id and archived_at is null
  ) then raise exception 'Tiers introuvable dans cette organisation.'; end if;

  select id into v_transaction_id
  from public.treasury_transactions
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_transaction_id is not null then
    return query select v_transaction_id, true;
    return;
  end if;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    transaction_date, value_date, label, reference, description, third_party_id,
    created_by, idempotency_key
  ) values (
    p_organization_id, p_treasury_account_id, p_transaction_type, p_direction,
    round(p_amount, 2), coalesce(p_transaction_date, current_date), p_value_date,
    btrim(p_label), nullif(btrim(p_reference), ''), nullif(btrim(p_description), ''),
    p_third_party_id, auth.uid(), p_idempotency_key
  )
  on conflict (organization_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id from public.treasury_transactions
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
    return query select v_transaction_id, true;
    return;
  end if;
  return query select v_transaction_id, false;
end;
$$;

revoke all on function public.create_treasury_transaction_atomic(uuid, uuid, text, text, numeric, date, uuid, date, text, text, text, uuid) from public, anon;
grant execute on function public.create_treasury_transaction_atomic(uuid, uuid, text, text, numeric, date, uuid, date, text, text, text, uuid) to authenticated;

create or replace function public.archive_treasury_transaction_atomic(
  p_organization_id uuid,
  p_transaction_id uuid
)
returns table(transaction_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaction public.treasury_transactions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  select * into v_transaction from public.treasury_transactions
  where id = p_transaction_id and organization_id = p_organization_id
  for update;
  if v_transaction.id is null then raise exception 'Mouvement de tresorerie introuvable.'; end if;
  if v_transaction.archived_at is not null then
    return query select p_transaction_id, true;
    return;
  end if;
  if v_transaction.customer_payment_id is not null
     or v_transaction.supplier_payment_id is not null
     or v_transaction.transfer_group_id is not null then
    raise exception 'Ce mouvement lie doit etre annule depuis son document d''origine.';
  end if;
  update public.treasury_transactions
  set archived_at = now(), updated_at = now()
  where id = p_transaction_id and organization_id = p_organization_id;
  return query select p_transaction_id, false;
end;
$$;

revoke all on function public.archive_treasury_transaction_atomic(uuid, uuid) from public, anon;
grant execute on function public.archive_treasury_transaction_atomic(uuid, uuid) to authenticated;

create or replace function public.create_treasury_transaction_from_statement_line_atomic(
  p_organization_id uuid,
  p_statement_line_id uuid
)
returns table(transaction_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line public.bank_statement_lines%rowtype;
  v_transaction_id uuid;
  v_type text;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  select * into v_line from public.bank_statement_lines
  where id = p_statement_line_id and organization_id = p_organization_id
  for update;
  if v_line.id is null then raise exception 'Ligne de releve introuvable.'; end if;
  if v_line.reconciliation_status = 'reconciled' and v_line.matched_transaction_id is not null then
    return query select v_line.matched_transaction_id, true;
    return;
  end if;
  if v_line.reconciliation_status <> 'unreconciled' then
    raise exception 'Cette ligne de releve ne peut pas creer un mouvement.';
  end if;
  perform 1 from public.treasury_accounts
  where id = v_line.treasury_account_id and organization_id = p_organization_id
    and status = 'active' and archived_at is null
  for update;
  if not found then raise exception 'Compte de tresorerie introuvable ou inactif.'; end if;
  v_type := case
    when lower(coalesce(v_line.label, '')) like '%frais%' then 'bank_fee'
    when v_line.direction = 'in' then 'manual_in'
    else 'manual_out'
  end;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    transaction_date, value_date, label, reference, reconciliation_status,
    reconciled_at, reconciled_by, created_by
  ) values (
    p_organization_id, v_line.treasury_account_id, v_type, v_line.direction,
    v_line.amount, v_line.operation_date, v_line.value_date, v_line.label,
    v_line.reference, 'reconciled', now(), auth.uid(), auth.uid()
  ) returning id into v_transaction_id;

  insert into public.bank_reconciliations (
    organization_id, treasury_account_id, statement_line_id, transaction_id,
    amount, created_by
  ) values (
    p_organization_id, v_line.treasury_account_id, v_line.id, v_transaction_id,
    v_line.amount, auth.uid()
  );

  update public.bank_statement_lines
  set reconciliation_status = 'reconciled', matched_transaction_id = v_transaction_id,
      matched_at = now(), matched_by = auth.uid()
  where id = v_line.id and organization_id = p_organization_id;

  return query select v_transaction_id, false;
end;
$$;

revoke all on function public.create_treasury_transaction_from_statement_line_atomic(uuid, uuid) from public, anon;
grant execute on function public.create_treasury_transaction_from_statement_line_atomic(uuid, uuid) to authenticated;

create or replace function public.link_stock_move_to_sales_line()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.source_line_id is not null and new.move_type in ('delivery_out', 'customer_return_in') then
    update public.sales_document_lines
    set stock_move_id = new.id, updated_at = now()
    where id = new.source_line_id
      and organization_id = new.organization_id;
  elsif new.source_line_id is not null and new.move_type = 'purchase_receipt_in' then
    update public.purchase_document_lines
    set stock_move_id = new.id, updated_at = now()
    where id = new.source_line_id
      and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_moves_link_sales_line on public.stock_moves;
create trigger stock_moves_link_sales_line
after insert on public.stock_moves
for each row execute function public.link_stock_move_to_sales_line();

revoke all on function public.link_stock_move_to_sales_line() from public, anon;

alter table public.stock_moves
  add column if not exists stock_operation_key uuid null,
  add column if not exists stock_operation_index integer null;

create unique index if not exists stock_moves_operation_line_unique
  on public.stock_moves (organization_id, stock_operation_key, stock_operation_index)
  where stock_operation_key is not null and stock_operation_index is not null;

create or replace function public.update_stock_level()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_warehouse_id uuid;
  v_available numeric(14,3);
  v_delta numeric(14,3);
begin
  if new.quantity is null or new.quantity <= 0 then
    raise exception 'La quantite du mouvement de stock doit etre positive.';
  end if;
  if new.direction not in ('in', 'out') then
    raise exception 'Le sens du mouvement de stock est invalide.';
  end if;

  v_warehouse_id := coalesce(new.warehouse_id, public.get_default_warehouse_id(new.organization_id));
  perform 1 from public.warehouses
  where id = v_warehouse_id and organization_id = new.organization_id
    and status = 'active' and archived_at is null;
  if not found then raise exception 'Emplacement de stock introuvable dans cette organisation.'; end if;

  perform 1 from public.products
  where id = new.product_id and organization_id = new.organization_id
    and type = 'product' and track_stock = true and archived_at is null
  for update;
  if not found then raise exception 'Produit suivi en stock introuvable dans cette organisation.'; end if;

  if new.move_type = 'purchase_receipt_in' then
    perform 1
    from public.purchase_document_lines line
    join public.purchase_documents document on document.id = line.document_id
    where line.id = new.source_line_id
      and line.organization_id = new.organization_id
      and line.document_id = new.source_document_id
      and line.product_id = new.product_id
      and document.organization_id = new.organization_id
      and document.document_type = 'supplier_receipt';
    if not found then
      raise exception 'La ligne source de reception fournisseur est incoherente.';
    end if;
  elsif new.move_type in ('delivery_out', 'customer_return_in') then
    perform 1
    from public.sales_document_lines line
    join public.sales_documents document on document.id = line.document_id
    where line.id = new.source_line_id
      and line.organization_id = new.organization_id
      and line.document_id = new.source_document_id
      and line.product_id = new.product_id
      and document.organization_id = new.organization_id
      and document.document_type = case
        when new.move_type = 'delivery_out' then 'delivery_note'
        else 'return_note'
      end;
    if not found then
      raise exception 'La ligne source du mouvement client est incoherente.';
    end if;
  end if;

  insert into public.stock_levels (organization_id, warehouse_id, product_id, quantity)
  values (new.organization_id, v_warehouse_id, new.product_id, 0)
  on conflict (organization_id, warehouse_id, product_id) do nothing;

  select quantity into v_available
  from public.stock_levels
  where organization_id = new.organization_id
    and warehouse_id = v_warehouse_id
    and product_id = new.product_id
  for update;

  if new.direction = 'out' and coalesce(v_available, 0) + 0.0005 < new.quantity then
    raise exception 'Stock insuffisant dans cet emplacement.';
  end if;

  v_delta := case when new.direction = 'out' then -new.quantity else new.quantity end;
  update public.stock_levels
  set quantity = quantity + v_delta, updated_at = now()
  where organization_id = new.organization_id
    and warehouse_id = v_warehouse_id
    and product_id = new.product_id;

  update public.products
  set current_stock = coalesce(current_stock, 0) + v_delta, updated_at = now()
  where id = new.product_id and organization_id = new.organization_id;

  new.warehouse_id := v_warehouse_id;
  return new;
end;
$$;

drop trigger if exists stock_moves_update_level on public.stock_moves;
create trigger stock_moves_update_level
before insert on public.stock_moves
for each row execute function public.update_stock_level();

revoke all on function public.update_stock_level() from public, anon;

create or replace function public.record_stock_movements_atomic(
  p_organization_id uuid,
  p_operation_key uuid,
  p_movements jsonb,
  p_finalize_document_type text default null,
  p_document_id uuid default null
)
returns table(movement_id uuid, source_line_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_movement jsonb;
  v_index integer;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_source_document_id uuid;
  v_source_line_id uuid;
  v_direction text;
  v_move_type text;
  v_quantity numeric(14,3);
  v_movement_date timestamptz;
  v_notes text;
  v_replayed boolean := false;
  v_document_status text;
  v_stock_updated_at timestamptz;
  v_related_order_id uuid;
  v_ordered_quantity numeric(14,3);
  v_completed_quantity numeric(14,3);
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if not app_private.has_org_permission(p_organization_id, 'stock.adjust') then
    raise exception 'Vous ne pouvez pas modifier le stock de cette organisation.';
  end if;
  if p_operation_key is null then raise exception 'Une cle d''idempotence stock est obligatoire.'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_operation_key::text, 0)
  );
  if p_movements is null or jsonb_typeof(p_movements) <> 'array' then
    raise exception 'Les mouvements de stock doivent former une liste.';
  end if;
  if jsonb_array_length(p_movements) = 0 and p_finalize_document_type is null then
    raise exception 'Aucun mouvement de stock a enregistrer.';
  end if;
  if jsonb_array_length(p_movements) > 500 then
    raise exception 'Une operation de stock ne peut pas depasser 500 lignes.';
  end if;

  if p_finalize_document_type is not null then
    if p_document_id is null or p_document_id <> p_operation_key then
      raise exception 'Le document de stock et sa cle d''idempotence doivent correspondre.';
    end if;
    if p_finalize_document_type = 'supplier_receipt' then
      select status, stock_updated_at, related_order_id
      into v_document_status, v_stock_updated_at, v_related_order_id
      from public.purchase_documents
      where id = p_document_id and organization_id = p_organization_id
        and document_type = 'supplier_receipt'
      for update;
    elsif p_finalize_document_type in ('delivery_note', 'return_note') then
      select status, stock_updated_at, related_order_id
      into v_document_status, v_stock_updated_at, v_related_order_id
      from public.sales_documents
      where id = p_document_id and organization_id = p_organization_id
        and document_type = p_finalize_document_type
      for update;
    else
      raise exception 'Type de document de stock non autorise.';
    end if;
    if not found then raise exception 'Document de stock introuvable.'; end if;
    if v_stock_updated_at is null and v_document_status <> 'draft' then
      raise exception 'Seul un document brouillon peut mettre a jour le stock.';
    end if;
  elsif p_document_id is not null then
    raise exception 'Le type du document de stock est obligatoire.';
  end if;

  v_replayed := exists (
    select 1 from public.stock_moves
    where organization_id = p_organization_id and stock_operation_key = p_operation_key
  );
  if v_stock_updated_at is not null and not v_replayed and jsonb_array_length(p_movements) > 0 then
    raise exception 'Le document est marque en stock sans mouvements idempotents correspondants.';
  end if;

  if not v_replayed then
    for v_movement, v_index in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(p_movements) with ordinality as item(value, ordinality)
  loop
    begin
      v_product_id := nullif(v_movement ->> 'product_id', '')::uuid;
      v_warehouse_id := nullif(v_movement ->> 'warehouse_id', '')::uuid;
      v_source_document_id := nullif(v_movement ->> 'source_document_id', '')::uuid;
      v_source_line_id := nullif(v_movement ->> 'source_line_id', '')::uuid;
      v_quantity := round((v_movement ->> 'quantity')::numeric, 3);
      v_movement_date := coalesce(nullif(v_movement ->> 'movement_date', '')::timestamptz, now());
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Ligne de mouvement de stock invalide.';
    end;
    v_direction := v_movement ->> 'direction';
    v_move_type := v_movement ->> 'move_type';
    v_notes := nullif(btrim(v_movement ->> 'notes'), '');

    if v_product_id is null or v_warehouse_id is null or coalesce(v_quantity, 0) <= 0 then
      raise exception 'Produit, emplacement et quantite sont obligatoires pour chaque mouvement.';
    end if;
    if v_direction not in ('in', 'out') then raise exception 'Sens de stock invalide.'; end if;
    if v_move_type not in (
      'delivery_out', 'customer_return_in', 'adjustment_in', 'adjustment_out',
      'manual_stock_in', 'manual_stock_out', 'initial_stock', 'purchase_in',
      'purchase_receipt_in'
    ) then raise exception 'Type de mouvement de stock non autorise.'; end if;
    if (v_move_type in ('delivery_out', 'adjustment_out', 'manual_stock_out') and v_direction <> 'out')
       or (v_move_type in ('customer_return_in', 'adjustment_in', 'manual_stock_in', 'initial_stock', 'purchase_in', 'purchase_receipt_in') and v_direction <> 'in') then
      raise exception 'Le sens du mouvement est incompatible avec son type.';
    end if;
    if v_move_type in ('delivery_out', 'customer_return_in', 'purchase_receipt_in')
       and (v_source_document_id is null or v_source_line_id is null) then
      raise exception 'Les mouvements issus d''un document exigent une source complete.';
    end if;
    if p_finalize_document_type is not null and v_source_document_id <> p_document_id then
      raise exception 'Une ligne de stock ne correspond pas au document finalise.';
    end if;
    if (p_finalize_document_type = 'supplier_receipt' and v_move_type <> 'purchase_receipt_in')
       or (p_finalize_document_type = 'delivery_note' and v_move_type <> 'delivery_out')
       or (p_finalize_document_type = 'return_note' and v_move_type <> 'customer_return_in') then
      raise exception 'Le type du mouvement ne correspond pas au document finalise.';
    end if;

    insert into public.stock_moves (
      organization_id, warehouse_id, product_id, source_document_id, source_line_id,
      move_type, direction, quantity, movement_date, notes, created_by,
      stock_operation_key, stock_operation_index
    ) values (
      p_organization_id, v_warehouse_id, v_product_id, v_source_document_id,
      v_source_line_id, v_move_type, v_direction, v_quantity, v_movement_date,
      v_notes, auth.uid(), p_operation_key, v_index
    );
    end loop;
  end if;

  if p_finalize_document_type = 'supplier_receipt' then
    update public.purchase_documents
    set status = 'validated', validated_at = coalesce(validated_at, now()),
        stock_updated_at = coalesce(stock_updated_at, now())
    where id = p_document_id and organization_id = p_organization_id;
  elsif p_finalize_document_type = 'delivery_note' then
    update public.sales_documents
    set status = 'validated', validated_at = coalesce(validated_at, now()),
        stock_updated_at = coalesce(stock_updated_at, now())
    where id = p_document_id and organization_id = p_organization_id;
  elsif p_finalize_document_type = 'return_note' then
    update public.sales_documents
    set status = 'validated', returned_at = coalesce(returned_at, now()),
        stock_updated_at = coalesce(stock_updated_at, now())
    where id = p_document_id and organization_id = p_organization_id;
  end if;

  if p_finalize_document_type = 'supplier_receipt' and v_related_order_id is not null then
    select
      coalesce(sum(order_line.quantity), 0),
      coalesce(sum(least(order_line.quantity, coalesce(receipt_quantity.quantity, 0))), 0)
    into v_ordered_quantity, v_completed_quantity
    from public.purchase_document_lines order_line
    left join lateral (
      select sum(receipt_line.quantity) as quantity
      from public.purchase_document_lines receipt_line
      join public.purchase_documents receipt
        on receipt.id = receipt_line.document_id
       and receipt.organization_id = p_organization_id
       and receipt.document_type = 'supplier_receipt'
       and receipt.status = 'validated'
       and receipt.archived_at is null
      where receipt_line.organization_id = p_organization_id
        and receipt_line.source_line_id = order_line.id
    ) receipt_quantity on true
    where order_line.organization_id = p_organization_id
      and order_line.document_id = v_related_order_id;

    update public.purchase_documents
    set status = case
      when v_ordered_quantity > 0 and v_completed_quantity >= v_ordered_quantity then 'received'
      when v_completed_quantity > 0 then 'partially_received'
      else 'confirmed'
    end
    where id = v_related_order_id
      and organization_id = p_organization_id
      and document_type = 'supplier_order'
      and status <> 'cancelled';
  elsif p_finalize_document_type = 'delivery_note' and v_related_order_id is not null then
    select
      coalesce(sum(order_line.quantity), 0),
      coalesce(sum(least(order_line.quantity, coalesce(delivery_quantity.quantity, 0))), 0)
    into v_ordered_quantity, v_completed_quantity
    from public.sales_document_lines order_line
    left join lateral (
      select sum(delivery_line.quantity) as quantity
      from public.sales_document_lines delivery_line
      join public.sales_documents delivery
        on delivery.id = delivery_line.document_id
       and delivery.organization_id = p_organization_id
       and delivery.document_type = 'delivery_note'
       and delivery.status in ('validated', 'delivered')
       and delivery.archived_at is null
      where delivery_line.organization_id = p_organization_id
        and delivery_line.source_line_id = order_line.id
    ) delivery_quantity on true
    where order_line.organization_id = p_organization_id
      and order_line.document_id = v_related_order_id;

    update public.sales_documents
    set status = case
      when v_ordered_quantity > 0 and v_completed_quantity >= v_ordered_quantity then 'delivered'
      when v_completed_quantity > 0 then 'partially_delivered'
      else 'confirmed'
    end
    where id = v_related_order_id
      and organization_id = p_organization_id
      and document_type = 'order'
      and status <> 'cancelled';
  end if;

  return query
  select stock_move.id, stock_move.source_line_id, v_replayed
  from public.stock_moves stock_move
  where stock_move.organization_id = p_organization_id
    and stock_move.stock_operation_key = p_operation_key
  order by stock_move.stock_operation_index;
end;
$$;

revoke all on function public.record_stock_movements_atomic(uuid, uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.record_stock_movements_atomic(uuid, uuid, jsonb, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Customer payment allocation invariants
-- ---------------------------------------------------------------------------
create or replace function public.sync_customer_payment_totals(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_amount numeric(14,2);
  v_status text;
  v_allocated numeric(14,2);
begin
  select amount, status into v_amount, v_status
  from public.customer_payments
  where id = p_payment_id
  for update;
  if not found then return; end if;

  select coalesce(sum(amount), 0)::numeric(14,2) into v_allocated
  from public.customer_payment_allocations
  where payment_id = p_payment_id and cancelled_at is null;

  update public.customer_payments
  set allocated_amount = least(v_allocated, v_amount),
      available_amount = case when v_status = 'cancelled' then 0 else greatest(v_amount - v_allocated, 0) end,
      status = case
        when v_status = 'cancelled' then 'cancelled'
        when v_allocated <= 0 then 'confirmed'
        when v_allocated >= v_amount then 'allocated'
        else 'partially_allocated'
      end,
      updated_at = now()
  where id = p_payment_id;
end;
$$;

create or replace function public.sync_customer_invoice_payment_totals(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_credit numeric(14,2);
  v_current_status text;
  v_paid numeric(14,2);
  v_remaining numeric(14,2);
  v_payment_status text;
begin
  select total_ttc, coalesce(credit_amount, 0), status
    into v_total, v_credit, v_current_status
  from public.customer_invoices
  where id = p_invoice_id
  for update;
  if not found then return; end if;

  select coalesce(sum(allocation.amount), 0)::numeric(14,2) into v_paid
  from public.customer_payment_allocations allocation
  join public.customer_payments payment on payment.id = allocation.payment_id
  where allocation.invoice_id = p_invoice_id
    and allocation.cancelled_at is null
    and payment.archived_at is null
    and payment.status in ('confirmed', 'partially_allocated', 'allocated');

  v_remaining := greatest(v_total - v_paid - v_credit, 0);
  v_payment_status := case
    when v_paid + v_credit <= 0 then 'unpaid'
    when v_remaining <= 0 then 'paid'
    else 'partial'
  end;

  update public.customer_invoices
  set paid_amount = least(v_paid, greatest(v_total - v_credit, 0)),
      remaining_amount = v_remaining,
      payment_status = v_payment_status,
      status = case
        when v_current_status in ('draft', 'cancelled') then v_current_status
        when v_payment_status = 'paid' then 'paid'
        when v_payment_status = 'partial' then 'partially_paid'
        when v_current_status in ('sent', 'overdue') then v_current_status
        else 'validated'
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.sync_customer_allocation_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_customer_payment_totals(old.payment_id);
    perform public.sync_customer_invoice_payment_totals(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_customer_payment_totals(new.payment_id);
    perform public.sync_customer_invoice_payment_totals(new.invoice_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.validate_customer_payment_allocation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.customer_payments%rowtype;
  v_invoice public.customer_invoices%rowtype;
  v_payment_allocated numeric(14,2);
  v_invoice_allocated numeric(14,2);
begin
  if new.cancelled_at is not null then return new; end if;

  select * into v_payment from public.customer_payments
  where id = new.payment_id for update;
  select * into v_invoice from public.customer_invoices
  where id = new.invoice_id for update;
  if v_payment.id is null or v_invoice.id is null then
    raise exception 'Paiement ou facture client introuvable.';
  end if;
  if v_payment.organization_id <> v_invoice.organization_id
     or new.organization_id <> v_invoice.organization_id then
    raise exception 'Allocation client inter-organisation interdite.';
  end if;
  if v_payment.third_party_id <> v_invoice.customer_id
     or new.third_party_id <> v_invoice.customer_id
     or coalesce(new.customer_id, new.third_party_id) <> v_invoice.customer_id then
    raise exception 'Le paiement et la facture doivent appartenir au même client.';
  end if;
  if v_payment.archived_at is not null or v_payment.status = 'cancelled'
     or v_invoice.archived_at is not null or v_invoice.status in ('draft', 'cancelled') then
    raise exception 'Allocation impossible sur un paiement ou une facture inactive.';
  end if;

  select coalesce(sum(amount), 0)::numeric(14,2) into v_payment_allocated
  from public.customer_payment_allocations
  where payment_id = new.payment_id and cancelled_at is null and id <> new.id;
  select coalesce(sum(amount), 0)::numeric(14,2) into v_invoice_allocated
  from public.customer_payment_allocations
  where invoice_id = new.invoice_id and cancelled_at is null and id <> new.id;

  if v_payment_allocated + new.amount > v_payment.amount + 0.01 then
    raise exception 'Le paiement client serait sur-affecté.';
  end if;
  if v_invoice_allocated + new.amount + coalesce(v_invoice.credit_amount, 0) > v_invoice.total_ttc + 0.01 then
    raise exception 'La facture client serait sur-réglée.';
  end if;
  return new;
end;
$$;

drop trigger if exists customer_allocations_validate on public.customer_payment_allocations;
create trigger customer_allocations_validate
before insert or update on public.customer_payment_allocations
for each row execute function public.validate_customer_payment_allocation();

drop trigger if exists customer_allocations_sync_totals on public.customer_payment_allocations;
create trigger customer_allocations_sync_totals
after insert or update or delete on public.customer_payment_allocations
for each row execute function public.sync_customer_allocation_state();

create or replace function public.sync_customer_invoices_after_payment_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  for v_invoice_id in
    select distinct invoice_id
    from public.customer_payment_allocations
    where payment_id = new.id and invoice_id is not null
  loop
    perform public.sync_customer_invoice_payment_totals(v_invoice_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists customer_payments_sync_invoices on public.customer_payments;
create trigger customer_payments_sync_invoices
after update of status, archived_at on public.customer_payments
for each row
when (old.status is distinct from new.status or old.archived_at is distinct from new.archived_at)
execute function public.sync_customer_invoices_after_payment_change();

revoke all on function public.sync_customer_payment_totals(uuid) from public, anon;
revoke all on function public.sync_customer_invoice_payment_totals(uuid) from public, anon;
revoke all on function public.sync_customer_allocation_state() from public, anon;
revoke all on function public.sync_customer_invoices_after_payment_change() from public, anon;
revoke all on function public.validate_customer_payment_allocation() from public, anon;
grant execute on function public.sync_customer_payment_totals(uuid) to authenticated;
grant execute on function public.sync_customer_invoice_payment_totals(uuid) to authenticated;

alter table public.customer_payments
  add column if not exists idempotency_key uuid null;

create unique index if not exists customer_payments_org_idempotency_unique
  on public.customer_payments (organization_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_customer_payment_atomic(
  p_organization_id uuid,
  p_third_party_id uuid,
  p_treasury_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_idempotency_key uuid,
  p_allocations jsonb default '[]'::jsonb,
  p_value_date date default null,
  p_payment_method text default 'bank_transfer',
  p_payment_type text default 'customer_payment',
  p_source_type text default 'manual',
  p_source_invoice_id uuid default null,
  p_reference text default null,
  p_bank_name text default null,
  p_check_number text default null,
  p_transfer_reference text default null,
  p_due_date date default null,
  p_notes text default null,
  p_internal_notes text default null,
  p_created_by uuid default auth.uid()
)
returns table(payment_id uuid, payment_number text, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_payment_number text;
  v_allocation jsonb;
  v_allocation_amount numeric(14,2);
  v_invoice_id uuid;
  v_total_allocated numeric(14,2) := 0;
  v_single_invoice_id uuid;
  v_allocation_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  p_created_by := auth.uid();
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant client doit Ãªtre positif.'; end if;
  if p_idempotency_key is null then raise exception 'Une clÃ© d''idempotence est obligatoire.'; end if;
  if p_allocations is null then p_allocations := '[]'::jsonb; end if;
  if jsonb_typeof(p_allocations) <> 'array' then raise exception 'Les affectations client doivent former une liste.'; end if;

  perform 1 from public.third_parties
  where id = p_third_party_id and organization_id = p_organization_id and archived_at is null;
  if not found then raise exception 'Client introuvable dans cette organisation.'; end if;
  if p_source_invoice_id is not null and not exists (
    select 1 from public.customer_invoices
    where id = p_source_invoice_id
      and organization_id = p_organization_id
      and customer_id = p_third_party_id
      and archived_at is null
  ) then raise exception 'Facture source client introuvable dans cette organisation.'; end if;
  perform 1 from public.treasury_accounts
  where id = p_treasury_account_id and organization_id = p_organization_id
    and status = 'active' and archived_at is null
  for update;
  if not found then raise exception 'Compte de trÃ©sorerie introuvable ou inactif.'; end if;

  select id, customer_payments.payment_number into v_payment_id, v_payment_number
  from public.customer_payments
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_payment_id is not null then
    return query select v_payment_id, v_payment_number, true;
    return;
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    begin
      v_invoice_id := nullif(v_allocation ->> 'invoice_id', '')::uuid;
      v_allocation_amount := round((v_allocation ->> 'amount')::numeric, 2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Affectation client invalide.';
    end;
    if v_invoice_id is null or v_allocation_amount is null or v_allocation_amount <= 0 then
      raise exception 'Chaque affectation client exige une facture et un montant positif.';
    end if;
    v_total_allocated := v_total_allocated + v_allocation_amount;
    v_allocation_count := v_allocation_count + 1;
    v_single_invoice_id := v_invoice_id;
  end loop;
  if v_total_allocated > p_amount + 0.01 then raise exception 'Les affectations dÃ©passent le paiement client.'; end if;
  if v_allocation_count <> 1 then v_single_invoice_id := null; end if;

  insert into public.customer_payments (
    organization_id, payment_number, third_party_id, customer_id,
    treasury_account_id, payment_date, value_date, amount, allocated_amount,
    available_amount, currency, payment_method, reference, bank_name,
    check_number, transfer_reference, due_date, status, payment_type,
    source_type, source_invoice_id, notes, internal_notes, confirmed_at,
    created_by, idempotency_key
  ) values (
    p_organization_id, '', p_third_party_id, p_third_party_id,
    p_treasury_account_id, p_payment_date, p_value_date, round(p_amount, 2), 0,
    round(p_amount, 2), 'MAD', p_payment_method, p_reference, p_bank_name,
    p_check_number, p_transfer_reference, p_due_date, 'confirmed', p_payment_type,
    p_source_type, p_source_invoice_id, p_notes, p_internal_notes, now(),
    p_created_by, p_idempotency_key
  )
  on conflict (organization_id, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning id, customer_payments.payment_number into v_payment_id, v_payment_number;

  if v_payment_id is null then
    select id, customer_payments.payment_number into v_payment_id, v_payment_number
    from public.customer_payments
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
    return query select v_payment_id, v_payment_number, true;
    return;
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    v_invoice_id := (v_allocation ->> 'invoice_id')::uuid;
    v_allocation_amount := round((v_allocation ->> 'amount')::numeric, 2);
    insert into public.customer_payment_allocations (
      organization_id, payment_id, invoice_id, third_party_id, customer_id,
      amount, notes, created_by
    ) values (
      p_organization_id, v_payment_id, v_invoice_id, p_third_party_id,
      p_third_party_id, v_allocation_amount, v_allocation ->> 'notes', p_created_by
    );
  end loop;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    currency, transaction_date, value_date, label, reference, third_party_id,
    customer_payment_id, customer_invoice_id, reconciliation_status, created_by
  ) values (
    p_organization_id, p_treasury_account_id, 'customer_payment', 'in',
    round(p_amount, 2), 'MAD', p_payment_date, p_value_date,
    trim('Encaissement client ' || coalesce(v_payment_number, '')),
    coalesce(p_reference, p_transfer_reference), p_third_party_id,
    v_payment_id, coalesce(v_single_invoice_id, p_source_invoice_id),
    'unreconciled', p_created_by
  );

  return query select v_payment_id, v_payment_number, false;
end;
$$;

revoke all on function public.create_customer_payment_atomic(
  uuid, uuid, uuid, numeric, date, uuid, jsonb, date, text, text, text,
  uuid, text, text, text, text, date, text, text, uuid
) from public, anon;
grant execute on function public.create_customer_payment_atomic(
  uuid, uuid, uuid, numeric, date, uuid, jsonb, date, text, text, text,
  uuid, text, text, text, text, date, text, text, uuid
) to authenticated;

create or replace function public.allocate_customer_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid,
  p_allocations jsonb,
  p_created_by uuid default auth.uid()
)
returns table(payment_id uuid, allocated_amount numeric, available_amount numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.customer_payments%rowtype;
  v_allocation jsonb;
  v_invoice_id uuid;
  v_amount numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  p_created_by := auth.uid();
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Aucune affectation client valide.';
  end if;
  select * into v_payment from public.customer_payments
  where id = p_payment_id and organization_id = p_organization_id for update;
  if v_payment.id is null then raise exception 'Paiement client introuvable.'; end if;
  if v_payment.archived_at is not null or v_payment.status in ('cancelled', 'allocated')
     or v_payment.available_amount <= 0 then
    raise exception 'Ce paiement client n''a plus de montant affectable.';
  end if;
  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    begin
      v_invoice_id := nullif(v_allocation ->> 'invoice_id', '')::uuid;
      v_amount := round((v_allocation ->> 'amount')::numeric, 2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Affectation client invalide.';
    end;
    if v_invoice_id is null or v_amount is null or v_amount <= 0 then
      raise exception 'Chaque affectation client exige une facture et un montant positif.';
    end if;
    insert into public.customer_payment_allocations (
      organization_id, payment_id, invoice_id, third_party_id, customer_id,
      amount, notes, created_by
    ) values (
      p_organization_id, p_payment_id, v_invoice_id, v_payment.third_party_id,
      v_payment.third_party_id, v_amount, v_allocation ->> 'notes', p_created_by
    );
  end loop;
  return query
  select payment.id, payment.allocated_amount, payment.available_amount
  from public.customer_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id;
end;
$$;

revoke all on function public.allocate_customer_payment_atomic(uuid, uuid, jsonb, uuid)
  from public, anon;
grant execute on function public.allocate_customer_payment_atomic(uuid, uuid, jsonb, uuid)
  to authenticated;

create or replace function public.unallocate_customer_payment_atomic(
  p_organization_id uuid,
  p_allocation_id uuid
)
returns table(allocation_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare v_cancelled_at timestamptz;
begin
  select cancelled_at into v_cancelled_at
  from public.customer_payment_allocations
  where id = p_allocation_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'Affectation client introuvable.'; end if;
  if v_cancelled_at is not null then
    return query select p_allocation_id, true;
    return;
  end if;
  update public.customer_payment_allocations set cancelled_at = now()
  where id = p_allocation_id and organization_id = p_organization_id;
  return query select p_allocation_id, false;
end;
$$;

revoke all on function public.unallocate_customer_payment_atomic(uuid, uuid)
  from public, anon;
grant execute on function public.unallocate_customer_payment_atomic(uuid, uuid)
  to authenticated;

create or replace function public.update_customer_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_value_date date default null,
  p_payment_method text default 'bank_transfer',
  p_payment_type text default 'customer_payment',
  p_reference text default null,
  p_bank_name text default null,
  p_check_number text default null,
  p_transfer_reference text default null,
  p_due_date date default null,
  p_notes text default null,
  p_internal_notes text default null
)
returns table(payment_id uuid, allocated_amount numeric, available_amount numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare v_payment public.customer_payments%rowtype;
begin
  select * into v_payment from public.customer_payments
  where id = p_payment_id and organization_id = p_organization_id for update;
  if v_payment.id is null then raise exception 'Paiement client introuvable.'; end if;
  if v_payment.status = 'cancelled' or v_payment.archived_at is not null then
    raise exception 'Un paiement client annulÃ© ou archivÃ© ne peut pas Ãªtre modifiÃ©.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount + 0.01 < v_payment.allocated_amount then
    raise exception 'Le montant ne peut pas Ãªtre infÃ©rieur au montant dÃ©jÃ  affectÃ©.';
  end if;

  update public.customer_payments
  set payment_date = p_payment_date,
      value_date = p_value_date,
      amount = round(p_amount, 2),
      available_amount = greatest(round(p_amount, 2) - allocated_amount, 0),
      payment_method = p_payment_method,
      payment_type = p_payment_type,
      reference = p_reference,
      bank_name = p_bank_name,
      check_number = p_check_number,
      transfer_reference = p_transfer_reference,
      due_date = p_due_date,
      notes = p_notes,
      internal_notes = p_internal_notes
  where id = p_payment_id and organization_id = p_organization_id;

  update public.treasury_transactions
  set amount = round(p_amount, 2),
      transaction_date = p_payment_date,
      value_date = p_value_date,
      reference = coalesce(p_reference, p_transfer_reference),
      updated_at = now()
  where organization_id = p_organization_id
    and customer_payment_id = p_payment_id
    and archived_at is null;

  return query
  select payment.id, payment.allocated_amount, payment.available_amount
  from public.customer_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id;
end;
$$;

revoke all on function public.update_customer_payment_atomic(
  uuid, uuid, numeric, date, date, text, text, text, text, text, text,
  date, text, text
) from public, anon;
grant execute on function public.update_customer_payment_atomic(
  uuid, uuid, numeric, date, date, text, text, text, text, text, text,
  date, text, text
) to authenticated;

create or replace function public.cancel_customer_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid
)
returns table(payment_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from public.customer_payments
  where id = p_payment_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Paiement client introuvable.'; end if;
  if v_status = 'cancelled' then
    return query select p_payment_id, true;
    return;
  end if;
  update public.customer_payment_allocations
  set cancelled_at = coalesce(cancelled_at, now())
  where organization_id = p_organization_id and payment_id = p_payment_id
    and cancelled_at is null;
  update public.customer_payments
  set status = 'cancelled', cancelled_at = now(), allocated_amount = 0,
      available_amount = 0
  where organization_id = p_organization_id and id = p_payment_id;
  update public.treasury_transactions
  set archived_at = now(), updated_at = now()
  where organization_id = p_organization_id and customer_payment_id = p_payment_id
    and archived_at is null;
  return query select p_payment_id, false;
end;
$$;

revoke all on function public.cancel_customer_payment_atomic(uuid, uuid)
  from public, anon;
grant execute on function public.cancel_customer_payment_atomic(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Supplier payment allocation invariants
-- ---------------------------------------------------------------------------
create or replace function public.sync_supplier_payment_totals(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_amount numeric(14,2);
  v_status text;
  v_allocated numeric(14,2);
begin
  select amount, status into v_amount, v_status
  from public.supplier_payments
  where id = p_payment_id
  for update;
  if not found then return; end if;

  select coalesce(sum(amount), 0)::numeric(14,2) into v_allocated
  from public.supplier_payment_allocations
  where payment_id = p_payment_id and cancelled_at is null;

  update public.supplier_payments
  set allocated_amount = least(v_allocated, v_amount),
      available_amount = case when v_status = 'cancelled' then 0 else greatest(v_amount - v_allocated, 0) end,
      status = case
        when v_status = 'cancelled' then 'cancelled'
        when v_allocated <= 0 then 'confirmed'
        when v_allocated >= v_amount then 'allocated'
        else 'partially_allocated'
      end,
      updated_at = now()
  where id = p_payment_id;
end;
$$;

revoke all on function public.sync_supplier_payment_totals(uuid) from public, anon;
grant execute on function public.sync_supplier_payment_totals(uuid) to authenticated;

create or replace function public.sync_supplier_invoice_payment_totals(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_current_status text;
  v_paid numeric(14,2);
  v_payment_status text;
begin
  select total_ttc, status into v_total, v_current_status
  from public.supplier_invoices
  where id = p_invoice_id
  for update;
  if not found then return; end if;

  select coalesce(sum(allocation.amount), 0)::numeric(14,2) into v_paid
  from public.supplier_payment_allocations allocation
  join public.supplier_payments payment on payment.id = allocation.payment_id
  where allocation.invoice_id = p_invoice_id
    and allocation.cancelled_at is null
    and payment.archived_at is null
    and payment.status in ('confirmed', 'partially_allocated', 'allocated');

  v_payment_status := case
    when v_paid <= 0 then 'unpaid'
    when v_paid >= v_total then 'paid'
    else 'partial'
  end;

  update public.supplier_invoices
  set paid_amount = least(v_paid, v_total),
      remaining_amount = greatest(v_total - v_paid, 0),
      payment_status = v_payment_status,
      status = case
        when v_current_status in ('draft', 'cancelled') then v_current_status
        when v_payment_status = 'paid' then 'paid'
        when v_payment_status = 'partial' then 'partially_paid'
        else 'validated'
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

revoke all on function public.sync_supplier_invoice_payment_totals(uuid) from public, anon;
grant execute on function public.sync_supplier_invoice_payment_totals(uuid) to authenticated;

create or replace function public.sync_supplier_allocation_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_supplier_payment_totals(old.payment_id);
    perform public.sync_supplier_invoice_payment_totals(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_supplier_payment_totals(new.payment_id);
    perform public.sync_supplier_invoice_payment_totals(new.invoice_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.validate_supplier_payment_allocation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.supplier_payments%rowtype;
  v_invoice public.supplier_invoices%rowtype;
  v_payment_allocated numeric(14,2);
  v_invoice_allocated numeric(14,2);
begin
  if new.cancelled_at is not null then return new; end if;

  select * into v_payment from public.supplier_payments
  where id = new.payment_id for update;
  select * into v_invoice from public.supplier_invoices
  where id = new.invoice_id for update;
  if v_payment.id is null or v_invoice.id is null then
    raise exception 'Paiement ou facture fournisseur introuvable.';
  end if;
  if v_payment.organization_id <> v_invoice.organization_id
     or new.organization_id <> v_invoice.organization_id then
    raise exception 'Allocation fournisseur inter-organisation interdite.';
  end if;
  if v_payment.supplier_id <> v_invoice.supplier_id
     or new.supplier_id <> v_invoice.supplier_id then
    raise exception 'Le paiement et la facture doivent appartenir au même fournisseur.';
  end if;
  if v_payment.archived_at is not null or v_payment.status = 'cancelled'
     or v_invoice.archived_at is not null or v_invoice.status in ('draft', 'cancelled') then
    raise exception 'Allocation impossible sur un paiement ou une facture inactive.';
  end if;

  select coalesce(sum(amount), 0)::numeric(14,2) into v_payment_allocated
  from public.supplier_payment_allocations
  where payment_id = new.payment_id and cancelled_at is null and id <> new.id;
  select coalesce(sum(amount), 0)::numeric(14,2) into v_invoice_allocated
  from public.supplier_payment_allocations
  where invoice_id = new.invoice_id and cancelled_at is null and id <> new.id;

  if v_payment_allocated + new.amount > v_payment.amount + 0.01 then
    raise exception 'Le paiement fournisseur serait sur-affecté.';
  end if;
  if v_invoice_allocated + new.amount > v_invoice.total_ttc + 0.01 then
    raise exception 'La facture fournisseur serait sur-réglée.';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_allocations_validate on public.supplier_payment_allocations;
create trigger supplier_allocations_validate
before insert or update on public.supplier_payment_allocations
for each row execute function public.validate_supplier_payment_allocation();

drop trigger if exists supplier_allocations_sync_totals on public.supplier_payment_allocations;
create trigger supplier_allocations_sync_totals
after insert or update or delete on public.supplier_payment_allocations
for each row execute function public.sync_supplier_allocation_state();

revoke all on function public.sync_supplier_allocation_state() from public, anon;

create or replace function public.sync_supplier_invoices_after_payment_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  for v_invoice_id in
    select distinct invoice_id
    from public.supplier_payment_allocations
    where payment_id = new.id and invoice_id is not null
  loop
    perform public.sync_supplier_invoice_payment_totals(v_invoice_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists supplier_payments_sync_invoices on public.supplier_payments;
create trigger supplier_payments_sync_invoices
after update of status, archived_at on public.supplier_payments
for each row
when (old.status is distinct from new.status or old.archived_at is distinct from new.archived_at)
execute function public.sync_supplier_invoices_after_payment_change();

revoke all on function public.sync_supplier_invoices_after_payment_change() from public, anon;
revoke all on function public.validate_supplier_payment_allocation() from public, anon;

-- ---------------------------------------------------------------------------
-- Atomic and idempotent supplier payment creation
-- ---------------------------------------------------------------------------
alter table public.supplier_payments
  add column if not exists idempotency_key uuid null;

create unique index if not exists supplier_payments_org_idempotency_unique
  on public.supplier_payments (organization_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_supplier_payment_atomic(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_treasury_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_idempotency_key uuid,
  p_allocations jsonb default '[]'::jsonb,
  p_value_date date default null,
  p_payment_method text default null,
  p_reference text default null,
  p_bank_name text default null,
  p_check_number text default null,
  p_transfer_reference text default null,
  p_due_date date default null,
  p_notes text default null,
  p_created_by uuid default auth.uid()
)
returns table(payment_id uuid, payment_number text, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_payment_number text;
  v_allocation jsonb;
  v_allocation_amount numeric(14,2);
  v_invoice_id uuid;
  v_total_allocated numeric(14,2) := 0;
  v_single_invoice_id uuid;
  v_allocation_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  p_created_by := auth.uid();
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement fournisseur doit Ãªtre positif.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Une clÃ© d''idempotence est obligatoire.';
  end if;
  if p_allocations is null then p_allocations := '[]'::jsonb; end if;
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Les affectations fournisseur doivent former une liste.';
  end if;

  perform 1 from public.third_parties
  where id = p_supplier_id and organization_id = p_organization_id and archived_at is null;
  if not found then raise exception 'Fournisseur introuvable dans cette organisation.'; end if;

  perform 1 from public.treasury_accounts
  where id = p_treasury_account_id
    and organization_id = p_organization_id
    and status = 'active'
    and archived_at is null
  for update;
  if not found then raise exception 'Compte de trÃ©sorerie introuvable ou inactif.'; end if;

  select id, supplier_payments.payment_number
    into v_payment_id, v_payment_number
  from public.supplier_payments
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if v_payment_id is not null then
    return query select v_payment_id, v_payment_number, true;
    return;
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    begin
      v_invoice_id := nullif(v_allocation ->> 'invoice_id', '')::uuid;
      v_allocation_amount := round((v_allocation ->> 'amount')::numeric, 2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Affectation fournisseur invalide.';
    end;
    if v_invoice_id is null or v_allocation_amount is null or v_allocation_amount <= 0 then
      raise exception 'Chaque affectation doit contenir une facture et un montant positif.';
    end if;
    v_total_allocated := v_total_allocated + v_allocation_amount;
    v_allocation_count := v_allocation_count + 1;
    v_single_invoice_id := v_invoice_id;
  end loop;

  if v_total_allocated > p_amount + 0.01 then
    raise exception 'Le total des affectations dÃ©passe le paiement fournisseur.';
  end if;
  if v_allocation_count <> 1 then v_single_invoice_id := null; end if;

  insert into public.supplier_payments (
    organization_id, payment_number, supplier_id, treasury_account_id,
    amount, allocated_amount, available_amount, currency, payment_date,
    value_date, payment_method, reference, bank_name, check_number,
    transfer_reference, due_date, notes, status, payment_type, created_by,
    idempotency_key
  ) values (
    p_organization_id, '', p_supplier_id, p_treasury_account_id,
    round(p_amount, 2), 0, round(p_amount, 2), 'MAD', p_payment_date,
    p_value_date, p_payment_method, p_reference, p_bank_name, p_check_number,
    p_transfer_reference, p_due_date, p_notes, 'confirmed', 'supplier_payment',
    p_created_by, p_idempotency_key
  )
  on conflict (organization_id, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning id, supplier_payments.payment_number into v_payment_id, v_payment_number;

  if v_payment_id is null then
    select id, supplier_payments.payment_number
      into v_payment_id, v_payment_number
    from public.supplier_payments
    where organization_id = p_organization_id
      and idempotency_key = p_idempotency_key;
    return query select v_payment_id, v_payment_number, true;
    return;
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    v_invoice_id := (v_allocation ->> 'invoice_id')::uuid;
    v_allocation_amount := round((v_allocation ->> 'amount')::numeric, 2);
    insert into public.supplier_payment_allocations (
      organization_id, payment_id, invoice_id, supplier_id, amount, created_by
    ) values (
      p_organization_id, v_payment_id, v_invoice_id, p_supplier_id,
      v_allocation_amount, p_created_by
    );
  end loop;

  insert into public.treasury_transactions (
    organization_id, treasury_account_id, transaction_type, direction, amount,
    currency, transaction_date, value_date, label, reference, third_party_id,
    supplier_payment_id, supplier_invoice_id, reconciliation_status, created_by
  ) values (
    p_organization_id, p_treasury_account_id, 'supplier_payment', 'out',
    round(p_amount, 2), 'MAD', p_payment_date, p_value_date,
    trim('Paiement fournisseur ' || coalesce(v_payment_number, '')),
    coalesce(p_reference, p_transfer_reference), p_supplier_id,
    v_payment_id, v_single_invoice_id, 'unreconciled', p_created_by
  );

  return query select v_payment_id, v_payment_number, false;
end;
$$;

revoke all on function public.create_supplier_payment_atomic(
  uuid, uuid, uuid, numeric, date, uuid, jsonb, date, text, text, text,
  text, text, date, text, uuid
) from public, anon;
grant execute on function public.create_supplier_payment_atomic(
  uuid, uuid, uuid, numeric, date, uuid, jsonb, date, text, text, text,
  text, text, date, text, uuid
) to authenticated;

create or replace function public.allocate_supplier_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid,
  p_allocations jsonb,
  p_created_by uuid default auth.uid()
)
returns table(payment_id uuid, allocated_amount numeric, available_amount numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.supplier_payments%rowtype;
  v_allocation jsonb;
  v_invoice_id uuid;
  v_amount numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  p_created_by := auth.uid();
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Aucune affectation fournisseur valide.';
  end if;

  select * into v_payment
  from public.supplier_payments
  where id = p_payment_id and organization_id = p_organization_id
  for update;
  if v_payment.id is null then raise exception 'Paiement fournisseur introuvable.'; end if;
  if v_payment.archived_at is not null or v_payment.status in ('cancelled', 'allocated')
     or v_payment.available_amount <= 0 then
    raise exception 'Ce paiement fournisseur n''a plus de montant affectable.';
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    begin
      v_invoice_id := nullif(v_allocation ->> 'invoice_id', '')::uuid;
      v_amount := round((v_allocation ->> 'amount')::numeric, 2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Affectation fournisseur invalide.';
    end;
    if v_invoice_id is null or v_amount is null or v_amount <= 0 then
      raise exception 'Chaque affectation doit contenir une facture et un montant positif.';
    end if;
    insert into public.supplier_payment_allocations (
      organization_id, payment_id, invoice_id, supplier_id, amount, created_by
    ) values (
      p_organization_id, p_payment_id, v_invoice_id, v_payment.supplier_id,
      v_amount, p_created_by
    );
  end loop;

  return query
  select payment.id, payment.allocated_amount, payment.available_amount
  from public.supplier_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id;
end;
$$;

revoke all on function public.allocate_supplier_payment_atomic(uuid, uuid, jsonb, uuid)
  from public, anon;
grant execute on function public.allocate_supplier_payment_atomic(uuid, uuid, jsonb, uuid)
  to authenticated;

create or replace function public.cancel_supplier_payment_atomic(
  p_organization_id uuid,
  p_payment_id uuid
)
returns table(payment_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.supplier_payments
  where id = p_payment_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'Paiement fournisseur introuvable.'; end if;
  if v_status = 'cancelled' then
    return query select p_payment_id, true;
    return;
  end if;

  update public.supplier_payment_allocations
  set cancelled_at = coalesce(cancelled_at, now())
  where organization_id = p_organization_id
    and payment_id = p_payment_id
    and cancelled_at is null;

  update public.supplier_payments
  set status = 'cancelled', allocated_amount = 0, available_amount = 0,
      updated_at = now()
  where organization_id = p_organization_id and id = p_payment_id;

  update public.treasury_transactions
  set archived_at = now(), updated_at = now()
  where organization_id = p_organization_id
    and supplier_payment_id = p_payment_id
    and archived_at is null;

  return query select p_payment_id, false;
end;
$$;

revoke all on function public.cancel_supplier_payment_atomic(uuid, uuid)
  from public, anon;
grant execute on function public.cancel_supplier_payment_atomic(uuid, uuid)
  to authenticated;

/*
Historical backfills were intentionally disabled here. A schema migration must
not rewrite every tenant without a prior dry-run, a tenant scope and a repair
journal. Use scripts/repair-data-integrity.ts after reviewing its report.

-- Repair all existing allocation-derived values.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.supplier_payments loop
    perform public.sync_supplier_payment_totals(v_id);
  end loop;
  for v_id in select id from public.supplier_invoices loop
    perform public.sync_supplier_invoice_payment_totals(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Historical document and stock repairs
-- ---------------------------------------------------------------------------
with totals as (
  select document_id,
    coalesce(sum(subtotal_ht), 0)::numeric(14,2) as subtotal_ht,
    coalesce(sum(discount_amount), 0)::numeric(14,2) as discount_total,
    coalesce(sum(tax_amount), 0)::numeric(14,2) as tax_total,
    coalesce(sum(total_ttc), 0)::numeric(14,2) as total_ttc
  from public.purchase_document_lines
  group by document_id
)
update public.purchase_documents document
set subtotal_ht = totals.subtotal_ht,
    discount_total = totals.discount_total,
    tax_total = totals.tax_total,
    total_ttc = totals.total_ttc,
    updated_at = now()
from totals
where document.id = totals.document_id
  and (document.subtotal_ht, document.discount_total, document.tax_total, document.total_ttc)
      is distinct from (totals.subtotal_ht, totals.discount_total, totals.tax_total, totals.total_ttc);

with latest_movement as (
  select distinct on (move.source_line_id) move.source_line_id, move.id
  from public.stock_moves move
  where move.source_line_id is not null
  order by move.source_line_id, move.created_at desc
)
update public.sales_document_lines line
set stock_move_id = latest_movement.id
from latest_movement
where line.stock_move_id is null
  and latest_movement.source_line_id = line.id;

with linked_orders as (
  select distinct on (orders.organization_id, orders.source_document_id)
    orders.organization_id, orders.source_document_id, orders.id
  from public.sales_documents orders
  where orders.document_type = 'order'
    and orders.source_document_id is not null
    and orders.archived_at is null
  order by orders.organization_id, orders.source_document_id, orders.created_at asc
)
update public.sales_documents quote
set related_order_id = linked_orders.id, updated_at = now()
from linked_orders
where quote.document_type = 'quote'
  and quote.related_order_id is null
  and linked_orders.organization_id = quote.organization_id
  and linked_orders.source_document_id = quote.id;

-- Add only the missing movement delta. The trigger records it in stock_levels;
-- the final reconciliation preserves all non-default warehouse quantities.
with movement_totals as (
  select product_id,
    coalesce(sum(case when direction = 'out' then -quantity else quantity end), 0)::numeric(14,3) as quantity
  from public.stock_moves
  group by product_id
), missing as (
  select product.id, product.organization_id, product.current_stock,
    coalesce(movement_totals.quantity, 0) as movement_quantity,
    public.get_default_warehouse_id(product.organization_id) as warehouse_id
  from public.products product
  left join movement_totals on movement_totals.product_id = product.id
  where product.track_stock = true
    and product.archived_at is null
    and abs(product.current_stock - coalesce(movement_totals.quantity, 0)) > 0.0005
)
insert into public.stock_moves (
  organization_id, warehouse_id, product_id, move_type, direction, quantity,
  movement_date, notes
)
select organization_id, warehouse_id, id,
  case when current_stock > movement_quantity then 'initial_stock' else 'adjustment_out' end,
  case when current_stock > movement_quantity then 'in' else 'out' end,
  abs(current_stock - movement_quantity), now(),
  'Reprise automatique du stock non historisé'
from missing;

with non_default_levels as (
  select product.id as product_id, product.organization_id,
    public.get_default_warehouse_id(product.organization_id) as default_warehouse_id,
    product.current_stock,
    coalesce(sum(level.quantity) filter (where level.warehouse_id <> public.get_default_warehouse_id(product.organization_id)), 0) as other_quantity
  from public.products product
  left join public.stock_levels level on level.product_id = product.id and level.organization_id = product.organization_id
  where product.track_stock = true and product.archived_at is null
  group by product.id, product.organization_id, product.current_stock
)
insert into public.stock_levels (organization_id, warehouse_id, product_id, quantity, updated_at)
select organization_id, default_warehouse_id, product_id, greatest(current_stock - other_quantity, 0), now()
from non_default_levels
on conflict (organization_id, warehouse_id, product_id)
do update set quantity = excluded.quantity, updated_at = now();

-- Repair posted customer invoice entries affected by the former double-discount
-- bug, but only when the exact missing amount equals the stored invoice discount.
with candidates as (
  select entry.id as entry_id, invoice.id as invoice_id,
    round(invoice.total_ttc - entry.total_debit, 2) as delta
  from public.accounting_entries entry
  join public.customer_invoices invoice
    on entry.source_document_type = 'customer_invoice'
   and entry.source_document_id = invoice.id
   and entry.organization_id = invoice.organization_id
  where entry.status = 'posted'
    and invoice.discount_total > 0
    and abs((invoice.total_ttc - entry.total_debit) - invoice.discount_total) <= 0.02
    and invoice.total_ttc > entry.total_debit
    and exists (select 1 from public.accounting_entry_lines line where line.entry_id = entry.id and line.debit > 0 and line.account_code like '342%')
    and exists (select 1 from public.accounting_entry_lines line where line.entry_id = entry.id and line.credit > 0 and line.account_code like '7%')
), customer_lines as (
  select distinct on (line.entry_id) line.id, line.entry_id, candidates.delta
  from public.accounting_entry_lines line
  join candidates on candidates.entry_id = line.entry_id
  where line.debit > 0 and line.account_code like '342%'
  order by line.entry_id, line.line_number
), revenue_lines as (
  select distinct on (line.entry_id) line.id, line.entry_id, candidates.delta
  from public.accounting_entry_lines line
  join candidates on candidates.entry_id = line.entry_id
  where line.credit > 0 and line.account_code like '7%'
  order by line.entry_id, line.line_number
)
update public.accounting_entry_lines line
set debit = line.debit + customer_lines.delta
from customer_lines
where line.id = customer_lines.id;

with candidates as (
  select entry.id as entry_id, round(invoice.total_ttc - entry.total_debit, 2) as delta
  from public.accounting_entries entry
  join public.customer_invoices invoice
    on entry.source_document_type = 'customer_invoice'
   and entry.source_document_id = invoice.id
   and entry.organization_id = invoice.organization_id
  where entry.status = 'posted'
    and invoice.discount_total > 0
    and abs((invoice.total_ttc - entry.total_debit) - invoice.discount_total) <= 0.02
    and invoice.total_ttc > entry.total_debit
    and exists (select 1 from public.accounting_entry_lines line where line.entry_id = entry.id and line.debit > 0 and line.account_code like '342%')
    and exists (select 1 from public.accounting_entry_lines line where line.entry_id = entry.id and line.credit > 0 and line.account_code like '7%')
), revenue_lines as (
  select distinct on (line.entry_id) line.id, line.entry_id, candidates.delta
  from public.accounting_entry_lines line
  join candidates on candidates.entry_id = line.entry_id
  where line.credit > 0 and line.account_code like '7%'
  order by line.entry_id, line.line_number
)
update public.accounting_entry_lines line
set credit = line.credit + revenue_lines.delta
from revenue_lines
where line.id = revenue_lines.id;

update public.accounting_entries entry
set total_debit = sums.total_debit,
    total_credit = sums.total_credit,
    updated_at = now()
from (
  select entry_id, sum(debit)::numeric(14,2) as total_debit, sum(credit)::numeric(14,2) as total_credit
  from public.accounting_entry_lines
  group by entry_id
) sums
where entry.id = sums.entry_id
  and entry.status = 'posted'
  and (entry.total_debit, entry.total_credit) is distinct from (sums.total_debit, sums.total_credit);
*/
