-- Felexia Pro: daily operations without organisation administration.
-- Additive policies: other roles retain their existing permissions and RLS.
-- 093 and 094 must already be installed. No membership is created or changed.
begin;

create or replace function app_private.is_operator_org_member(p_organization_id uuid)
returns boolean language sql stable security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members membership
    join public.roles role on role.id = membership.role_id
      and role.organization_id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid() and membership.status = 'active'
      and lower(btrim(role.name)) in ('operator', 'operateur', 'opérateur')
  );
$$;
revoke all on function app_private.is_operator_org_member(uuid) from public, anon;
grant execute on function app_private.is_operator_org_member(uuid) to authenticated;

-- V3 requires this permission for payment creation and allocation updates.
-- Specific guards below still deny bank administration, transfers, manual
-- movements, reconciliation, accounting posting and organisation settings.
insert into public.permissions(code, description) values
  ('treasury.create_payment', 'Créer et gérer les règlements clients et fournisseurs.')
on conflict (code) do nothing;

create or replace function app_private.seed_operator_role_permissions()
returns trigger language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if lower(btrim(new.name)) in ('operator', 'operateur', 'opérateur') then
    insert into public.role_permissions(role_id, permission_id)
    select new.id, permission.id from public.permissions permission
    where permission.code = 'treasury.create_payment'
    on conflict (role_id, permission_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function app_private.seed_operator_role_permissions() from public, anon, authenticated;
drop trigger if exists roles_seed_operator_permissions_v5 on public.roles;
create trigger roles_seed_operator_permissions_v5 after insert on public.roles
  for each row execute function app_private.seed_operator_role_permissions();

create or replace function app_private.seed_organization_operator_role()
returns trigger language plpgsql security definer
set search_path = public, app_private
as $$
begin
  insert into public.roles(organization_id, name, description)
  values (new.id, 'operator', 'Gère clients, fournisseurs, factures et règlements ; consulte les journaux sans administrer l’entreprise.')
  on conflict (organization_id, name) do nothing;
  return new;
end;
$$;
revoke all on function app_private.seed_organization_operator_role() from public, anon, authenticated;
drop trigger if exists organizations_seed_operator_role_v5 on public.organizations;
create trigger organizations_seed_operator_role_v5 after insert on public.organizations
  for each row execute function app_private.seed_organization_operator_role();

insert into public.roles(organization_id, name, description)
select organization.id, 'operator',
  'Gère clients, fournisseurs, factures et règlements ; consulte les journaux sans administrer l’entreprise.'
from public.organizations organization
on conflict (organization_id, name) do nothing;
insert into public.role_permissions(role_id, permission_id)
select role.id, permission.id from public.roles role cross join public.permissions permission
where lower(btrim(role.name)) in ('operator', 'operateur', 'opérateur')
  and permission.code = 'treasury.create_payment'
on conflict (role_id, permission_id) do nothing;

-- A treasury movement must reflect an existing payment in the same tenant,
-- account, currency and direction. A cancelled payment can only be archived.
create or replace function app_private.operator_payment_movement_is_valid(
  p_organization_id uuid, p_account_id uuid, p_type text, p_direction text,
  p_amount numeric, p_currency text, p_customer_payment_id uuid,
  p_supplier_payment_id uuid, p_archived_at timestamptz,
  p_reconciliation_status text, p_transfer_group_id uuid
)
returns boolean language sql stable security definer
set search_path = public, app_private
as $$
  select app_private.is_operator_org_member(p_organization_id)
    and p_transfer_group_id is null and p_reconciliation_status = 'unreconciled'
    and (
      (p_type = 'customer_payment' and p_direction = 'in'
        and p_customer_payment_id is not null and p_supplier_payment_id is null
        and exists (
          select 1 from public.customer_payments payment
          where payment.id = p_customer_payment_id and payment.organization_id = p_organization_id
            and payment.treasury_account_id = p_account_id and payment.amount = p_amount
            and payment.currency = p_currency
            and ((p_archived_at is null and payment.archived_at is null
                  and payment.status in ('confirmed', 'partially_allocated', 'allocated'))
              or (p_archived_at is not null and payment.status = 'cancelled'))
        ))
      or (p_type = 'supplier_payment' and p_direction = 'out'
        and p_supplier_payment_id is not null and p_customer_payment_id is null
        and exists (
          select 1 from public.supplier_payments payment
          where payment.id = p_supplier_payment_id and payment.organization_id = p_organization_id
            and payment.treasury_account_id = p_account_id and payment.amount = p_amount
            and payment.currency = p_currency
            and ((p_archived_at is null and payment.archived_at is null
                  and payment.status in ('confirmed', 'partially_allocated', 'allocated'))
              or (p_archived_at is not null and payment.status = 'cancelled'))
        ))
    );
$$;
revoke all on function app_private.operator_payment_movement_is_valid(uuid,uuid,text,text,numeric,text,uuid,uuid,timestamptz,text,uuid) from public, anon;
grant execute on function app_private.operator_payment_movement_is_valid(uuid,uuid,text,text,numeric,text,uuid,uuid,timestamptz,text,uuid) to authenticated;

-- FOR UPDATE is needed by the payment RPCs. A row trigger prevents actual
-- account writes, while allowing only the existing nested balance trigger.
create or replace function app_private.guard_operator_treasury_account_update()
returns trigger language plpgsql security invoker
set search_path = public, app_private
as $$
begin
  if app_private.is_operator_org_member(old.organization_id)
    or app_private.is_operator_org_member(new.organization_id) then
    if pg_trigger_depth() < 2
      or (to_jsonb(new) - array['current_balance','updated_at'])
        is distinct from (to_jsonb(old) - array['current_balance','updated_at']) then
      raise exception 'OPERATOR_ACCOUNT_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_operator_treasury_account_update() from public, anon;
drop trigger if exists operator_treasury_account_update_guard_v5 on public.treasury_accounts;
create trigger operator_treasury_account_update_guard_v5 before update on public.treasury_accounts
  for each row execute function app_private.guard_operator_treasury_account_update();

-- Invoice/payment numbering still runs in its original trigger. Operators
-- cannot edit a prefix, reset a counter or call this mechanism directly.
create or replace function app_private.guard_operator_numbering_write()
returns trigger language plpgsql security invoker
set search_path = public, app_private
as $$
begin
  if app_private.is_operator_org_member(new.organization_id)
    or (tg_op = 'UPDATE' and app_private.is_operator_org_member(old.organization_id)) then
    if pg_trigger_depth() < 2
      or new.document_type !~ '^CUSTOMER_(INVOICE|PAYMENT)_[0-9]{4}$' then
      raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.next_number <> old.next_number + 1
      or (to_jsonb(new) - array['next_number','updated_at'])
        is distinct from (to_jsonb(old) - array['next_number','updated_at'])
    ) then
      raise exception 'OPERATOR_NUMBERING_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_operator_numbering_write() from public, anon;
drop trigger if exists operator_numbering_write_guard_v5 on public.numbering_sequences;
create trigger operator_numbering_write_guard_v5 before insert or update on public.numbering_sequences
  for each row execute function app_private.guard_operator_numbering_write();

-- An operator can change allocations, but cannot change the monetary facts
-- of a payment already posted by an administrator. Its ledger stays intact.
create or replace function app_private.guard_operator_posted_payment_change()
returns trigger language plpgsql security invoker
set search_path = public, app_private
as $$
declare
  payment_source text := case when tg_table_name = 'customer_payments'
    then 'customer_payment' else 'supplier_payment' end;
begin
  if app_private.is_operator_org_member(old.organization_id)
    or (tg_op = 'UPDATE' and app_private.is_operator_org_member(new.organization_id)) then
    if exists (
      select 1 from public.accounting_entries entry
      where entry.organization_id = old.organization_id and entry.source_document_type = payment_source
        and entry.source_document_id = old.id and entry.status = 'posted'
    ) then
      if tg_op = 'DELETE' then
        raise exception 'OPERATOR_POSTED_PAYMENT_READ_ONLY' using errcode = '42501';
      end if;
      if new.status not in ('confirmed','partially_allocated','allocated')
        or (to_jsonb(new) - array['allocated_amount','available_amount','status','updated_at',
          'notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date'])
          is distinct from (to_jsonb(old) - array['allocated_amount','available_amount','status','updated_at',
          'notes','internal_notes','reference','bank_name','check_number','transfer_reference','due_date']) then
        raise exception 'OPERATOR_POSTED_PAYMENT_READ_ONLY' using errcode = '42501';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app_private.guard_operator_posted_payment_change() from public, anon;
drop trigger if exists operator_posted_payment_guard_v5 on public.customer_payments;
create trigger operator_posted_payment_guard_v5 before update or delete on public.customer_payments
  for each row execute function app_private.guard_operator_posted_payment_change();
drop trigger if exists operator_posted_payment_guard_v5 on public.supplier_payments;
create trigger operator_posted_payment_guard_v5 before update or delete on public.supplier_payments
  for each row execute function app_private.guard_operator_posted_payment_change();

do $$
declare
  target record;
  allow_business boolean;
  insert_guard text;
  update_guard text;
  update_check text;
  delete_guard text;
  ordinary_guard text := 'not app_private.is_operator_org_member(organization_id)';
begin
  -- Refuse a partial installation on critical tables with RLS disabled.
  for target in select relation.relname, relation.relrowsecurity
    from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = any(array[
      'roles','organization_members','invitations','company_settings','numbering_sequences',
      'third_parties','customer_invoices','customer_invoice_lines','supplier_invoices','supplier_invoice_lines',
      'customer_payments','customer_payment_allocations','supplier_payments','supplier_payment_allocations',
      'treasury_accounts','treasury_transactions','accounting_entries','accounting_entry_lines'
    ])
  loop
    if not target.relrowsecurity then raise exception 'RLS_DISABLED_REQUIRES_REVIEW: %', target.relname; end if;
  end loop;

  -- Default-deny writes on every existing tenant module for this role only.
  -- No SELECT policy is changed. Existing non-operator grants remain intact.
  for target in
    select relation.relname from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    join pg_attribute attribute on attribute.attrelid = relation.oid
    where namespace.nspname = 'public' and relation.relkind in ('r','p')
      and relation.relrowsecurity and attribute.attname = 'organization_id' and not attribute.attisdropped
  loop
    allow_business := target.relname = any(array[
      'third_parties','contacts','customer_invoices','customer_invoice_lines',
      'supplier_invoices','supplier_invoice_lines','customer_credit_notes',
      'customer_credit_note_lines','customer_credit_note_applications',
      'customer_payments','customer_payment_allocations','supplier_payments','supplier_payment_allocations'
    ]);
    insert_guard := case when allow_business then 'true' else ordinary_guard end;
    update_guard := insert_guard;
    update_check := insert_guard;
    delete_guard := insert_guard;
    if target.relname in ('customer_payments','supplier_payments') then
      delete_guard := ordinary_guard;
    elsif target.relname in ('customer_invoices','supplier_invoices','customer_credit_notes') then
      delete_guard := '(' || ordinary_guard || ' or status = ''draft'')';
    elsif target.relname in ('customer_invoice_lines','supplier_invoice_lines','customer_credit_note_lines') then
      delete_guard := '(' || ordinary_guard || ' or exists (select 1 from public.' ||
        case target.relname when 'customer_invoice_lines' then 'customer_invoices'
          when 'supplier_invoice_lines' then 'supplier_invoices' else 'customer_credit_notes' end ||
        ' parent where parent.id = ' || quote_ident(target.relname) || '.' ||
        case when target.relname = 'customer_credit_note_lines' then 'credit_note_id' else 'invoice_id' end ||
        ' and parent.organization_id = ' || quote_ident(target.relname) || '.organization_id and parent.status = ''draft''))';
    end if;
    if target.relname in ('treasury_accounts','numbering_sequences') then
      update_guard := 'true'; update_check := 'true';
      if target.relname = 'numbering_sequences' then insert_guard := 'true'; end if;
    elsif target.relname = 'audit_logs' then
      insert_guard := '(' || ordinary_guard || ' or actor_id = auth.uid())';
    elsif target.relname = 'treasury_transactions' then
      insert_guard := '(' || ordinary_guard || ' or app_private.operator_payment_movement_is_valid(organization_id,treasury_account_id,transaction_type,direction,amount,currency,customer_payment_id,supplier_payment_id,archived_at,reconciliation_status,transfer_group_id))';
      -- UPDATE must still find the old movement after its payment amount or
      -- status changed in the atomic RPC; validate the new values in CHECK.
      update_guard := '(' || ordinary_guard || ' or (transaction_type in (''customer_payment'',''supplier_payment'') and transfer_group_id is null and ((customer_payment_id is not null and supplier_payment_id is null) or (supplier_payment_id is not null and customer_payment_id is null))))';
      update_check := insert_guard;
    end if;
    execute format('drop policy if exists operator_insert_guard_v5 on public.%I', target.relname);
    execute format('drop policy if exists operator_update_guard_v5 on public.%I', target.relname);
    execute format('drop policy if exists operator_delete_guard_v5 on public.%I', target.relname);
    execute format('create policy operator_insert_guard_v5 on public.%I as restrictive for insert to authenticated with check (%s)', target.relname, insert_guard);
    execute format('create policy operator_update_guard_v5 on public.%I as restrictive for update to authenticated using (%s) with check (%s)', target.relname, update_guard, update_check);
    execute format('create policy operator_delete_guard_v5 on public.%I as restrictive for delete to authenticated using (%s)', target.relname, delete_guard);
  end loop;
end;
$$;

-- organizations has id rather than organization_id and needs its own guards.
drop policy if exists organizations_operator_update_guard_v5 on public.organizations;
create policy organizations_operator_update_guard_v5 on public.organizations as restrictive
  for update to authenticated using (not app_private.is_operator_org_member(id))
  with check (not app_private.is_operator_org_member(id));
drop policy if exists organizations_operator_delete_guard_v5 on public.organizations;
create policy organizations_operator_delete_guard_v5 on public.organizations as restrictive
  for delete to authenticated using (not app_private.is_operator_org_member(id));

-- Qualify existing cancellation statements: payment_id is also an OUT
-- parameter, so an unqualified reference otherwise raises PostgreSQL 42702.
-- The original invoker security, return contract and atomic behaviour remain.
-- 022 also attached set_updated_at() to allocations without creating its
-- required column. Add it when absent so cancelling an allocation can update.
alter table public.supplier_payment_allocations
  add column if not exists updated_at timestamptz default now();

create or replace function public.cancel_customer_payment_atomic(
  p_organization_id uuid, p_payment_id uuid
)
returns table(payment_id uuid, replayed boolean)
language plpgsql security invoker set search_path = public
as $$
declare v_status text;
begin
  select payment.status into v_status from public.customer_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id for update;
  if not found then raise exception 'Paiement client introuvable.'; end if;
  if v_status = 'cancelled' then return query select p_payment_id, true; return; end if;
  update public.customer_payment_allocations allocation
  set cancelled_at = coalesce(allocation.cancelled_at, now())
  where allocation.organization_id = p_organization_id and allocation.payment_id = p_payment_id
    and allocation.cancelled_at is null;
  update public.customer_payments payment
  set status = 'cancelled', cancelled_at = now(), allocated_amount = 0, available_amount = 0
  where payment.organization_id = p_organization_id and payment.id = p_payment_id;
  update public.treasury_transactions movement
  set archived_at = now(), updated_at = now()
  where movement.organization_id = p_organization_id and movement.customer_payment_id = p_payment_id
    and movement.archived_at is null;
  return query select p_payment_id, false;
end;
$$;

create or replace function public.cancel_supplier_payment_atomic(
  p_organization_id uuid, p_payment_id uuid
)
returns table(payment_id uuid, replayed boolean)
language plpgsql security invoker set search_path = public
as $$
declare v_status text;
begin
  select payment.status into v_status from public.supplier_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id for update;
  if not found then raise exception 'Paiement fournisseur introuvable.'; end if;
  if v_status = 'cancelled' then return query select p_payment_id, true; return; end if;
  update public.supplier_payment_allocations allocation
  set cancelled_at = coalesce(allocation.cancelled_at, now())
  where allocation.organization_id = p_organization_id and allocation.payment_id = p_payment_id
    and allocation.cancelled_at is null;
  update public.supplier_payments payment
  set status = 'cancelled', allocated_amount = 0, available_amount = 0, updated_at = now()
  where payment.organization_id = p_organization_id and payment.id = p_payment_id;
  update public.treasury_transactions movement
  set archived_at = now(), updated_at = now()
  where movement.organization_id = p_organization_id and movement.supplier_payment_id = p_payment_id
    and movement.archived_at is null;
  return query select p_payment_id, false;
end;
$$;

create or replace function public.update_customer_payment_atomic(
  p_organization_id uuid, p_payment_id uuid, p_amount numeric, p_payment_date date,
  p_value_date date default null, p_payment_method text default 'bank_transfer',
  p_payment_type text default 'customer_payment', p_reference text default null,
  p_bank_name text default null, p_check_number text default null,
  p_transfer_reference text default null, p_due_date date default null,
  p_notes text default null, p_internal_notes text default null
)
returns table(payment_id uuid, allocated_amount numeric, available_amount numeric)
language plpgsql security invoker set search_path = public
as $$
declare v_payment public.customer_payments%rowtype;
begin
  select payment.* into v_payment from public.customer_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id for update;
  if v_payment.id is null then raise exception 'Paiement client introuvable.'; end if;
  if v_payment.status = 'cancelled' or v_payment.archived_at is not null then
    raise exception 'Un paiement client annulé ou archivé ne peut pas être modifié.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount + 0.01 < v_payment.allocated_amount then
    raise exception 'Le montant ne peut pas être inférieur au montant déjà affecté.';
  end if;
  update public.customer_payments payment
  set payment_date = p_payment_date, value_date = p_value_date, amount = round(p_amount, 2),
      available_amount = greatest(round(p_amount, 2) - payment.allocated_amount, 0),
      payment_method = p_payment_method, payment_type = p_payment_type, reference = p_reference,
      bank_name = p_bank_name, check_number = p_check_number, transfer_reference = p_transfer_reference,
      due_date = p_due_date, notes = p_notes, internal_notes = p_internal_notes
  where payment.id = p_payment_id and payment.organization_id = p_organization_id;
  update public.treasury_transactions movement
  set amount = round(p_amount, 2), transaction_date = p_payment_date, value_date = p_value_date,
      reference = coalesce(p_reference, p_transfer_reference), updated_at = now()
  where movement.organization_id = p_organization_id and movement.customer_payment_id = p_payment_id
    and movement.archived_at is null;
  return query select payment.id, payment.allocated_amount, payment.available_amount
  from public.customer_payments payment
  where payment.id = p_payment_id and payment.organization_id = p_organization_id;
end;
$$;

-- 087 finalizes identity through SECURITY DEFINER and therefore bypasses RLS.
-- Preserve its contract/body, but require an organisation administrator before
-- the first write. Onboarding creates the owner/admin membership beforehand.
create or replace function public.finalize_organization_onboarding(
  p_organization_id uuid,
  p_name text,
  p_address text,
  p_city text,
  p_phone text,
  p_email text,
  p_currency text default 'MAD',
  p_logo_url text default null,
  p_logo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Vous devez etre connecte pour configurer une entreprise.';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise exception 'Vous n''avez pas acces a cette entreprise.';
  end if;

  if not app_private.is_org_admin(p_organization_id) then
    raise exception 'ADMIN_REQUIRED_FOR_ORGANIZATION_SETUP' using errcode = '42501';
  end if;

  update public.organizations
  set
    name = trim(p_name),
    legal_name = trim(p_name),
    commercial_name = trim(p_name),
    address = trim(p_address),
    city = trim(p_city),
    phone = trim(p_phone),
    email = lower(trim(p_email)),
    currency = 'MAD',
    ice = null,
    rc = null,
    if_number = null,
    tax_identifier = null,
    cnss = null,
    forme_juridique = null,
    ville_rc = null,
    website = null,
    activity = null,
    logo_url = coalesce(p_logo_url, logo_url),
    logo_path = coalesce(p_logo_path, logo_path),
    onboarding_completed = true,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now()
  where id = p_organization_id;

  if not found then
    raise exception 'Entreprise introuvable.';
  end if;

  insert into public.company_settings (
    organization_id,
    legal_name,
    commercial_name,
    ice,
    rc,
    if_number,
    tax_identifier,
    cnss,
    forme_juridique,
    ville_rc,
    address,
    city,
    phone,
    email,
    website,
    activity,
    currency,
    logo_url,
    logo_path,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    trim(p_name),
    trim(p_name),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    trim(p_address),
    trim(p_city),
    trim(p_phone),
    lower(trim(p_email)),
    null,
    null,
    'MAD',
    p_logo_url,
    p_logo_path,
    now(),
    now()
  )
  on conflict (organization_id) do update
  set
    legal_name = excluded.legal_name,
    commercial_name = excluded.commercial_name,
    ice = null,
    rc = null,
    if_number = null,
    tax_identifier = null,
    cnss = null,
    forme_juridique = null,
    ville_rc = null,
    address = excluded.address,
    city = excluded.city,
    phone = excluded.phone,
    email = excluded.email,
    website = null,
    activity = null,
    currency = 'MAD',
    logo_url = coalesce(excluded.logo_url, public.company_settings.logo_url),
    logo_path = coalesce(excluded.logo_path, public.company_settings.logo_path),
    updated_at = now();

  update public.profiles
  set default_organization_id = p_organization_id,
      updated_at = now()
  where id = v_user_id;

  return p_organization_id;
end;
$$;

commit;
