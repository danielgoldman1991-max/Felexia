-- 152: ESSENTIEL audit. Additive. The posted-entry guard is extended only so a
-- posted entry keeps its label and every non-lettering field. Lettering and
-- the organization check stay. Existing accounting settings are not updated.
-- Not applied here.
-- Rollback: supabase/rollbacks/152_essentiel_audit_rollback.sql

-- Stable id so stock balances can travel in a backup.
do $stock$
begin
  if to_regclass('public.stock_levels') is not null then
    alter table public.stock_levels add column if not exists id uuid default gen_random_uuid();
    update public.stock_levels set id = gen_random_uuid() where id is null;
    create unique index if not exists stock_levels_id_key on public.stock_levels (id);
  end if;
end;
$stock$;

-- New organizations only. Rows already stored keep their current value.
alter table public.accounting_settings add column if not exists auto_post_on_validation boolean not null default true;
alter table public.accounting_settings alter column auto_post_on_validation set default true;

create or replace function app_private.restore_confirmation_name(p_value text)
returns text
language sql
immutable
as $name$
  select btrim(regexp_replace(normalize(coalesce(p_value, ''), NFC), '\s+', ' ', 'g'));
$name$;
revoke all on function app_private.restore_confirmation_name(text) from public, anon, authenticated;

create or replace function app_private.restore_pro_tables()
returns text[]
language sql
immutable
as $pro$
  select array[
    'warehouses','sales_documents','sales_document_lines','purchase_documents','purchase_document_lines',
    'stock_moves','stock_levels','customer_reminders','customer_reminder_invoices',
    'bank_statement_imports','bank_statement_lines','bank_reconciliations',
    'bank_reconciliation_groups','bank_reconciliation_group_items',
    'hr_departments','hr_positions','hr_employees'
  ];
$pro$;
revoke all on function app_private.restore_pro_tables() from public, anon, authenticated;

create or replace function app_private.restore_table_in_backup(p_table text, p_include_pro boolean)
returns boolean
language sql
immutable
as $in$
  select p_table = any (array[
    'company_settings','product_categories','units','tax_rates','accounting_journals','accounting_accounts',
    'third_parties','third_party_contacts','third_party_addresses','products',
    'customer_invoices','customer_invoice_lines','customer_credit_notes','customer_credit_note_lines',
    'customer_payments','customer_payment_allocations','customer_credit_note_applications',
    'supplier_invoices','supplier_invoice_lines','supplier_invoice_attachments',
    'supplier_credit_notes','supplier_credit_note_lines','supplier_payments','supplier_payment_allocations',
    'supplier_credit_note_applications','treasury_accounts','treasury_transactions',
    'accounting_entries','accounting_entry_lines'
  ]) or (p_include_pro and p_table = any (app_private.restore_pro_tables()));
$in$;
revoke all on function app_private.restore_table_in_backup(text, boolean) from public, anon, authenticated;

create or replace function app_private.restore_external_module(p_table text)
returns text
language sql
immutable
as $module$
  select case
    when p_table like 'sales\_%' escape '\' or p_table like 'delivery\_%' escape '\' or p_table in ('customer_reminders', 'customer_reminder_invoices') then 'Ventes'
    when p_table like 'stock\_%' escape '\' or p_table like 'inventory\_%' escape '\' or p_table = 'warehouses' then 'Stock'
    when p_table like 'purchase\_%' escape '\' then 'Achats'
    when p_table like 'bank\_%' escape '\' then 'Banque'
    when p_table like 'hr\_%' escape '\' then 'RH'
    else 'Autres'
  end;
$module$;
revoke all on function app_private.restore_external_module(text) from public, anon, authenticated;

create or replace function app_private.restore_reject_external_refs(
  p_organization_id uuid,
  p_table text,
  p_ids uuid[],
  p_include_pro boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $reject$
declare
  ref record;
  has_org boolean;
  found_count integer;
  totals jsonb := '{}'::jsonb;
  detail text;
begin
  if p_ids is null or cardinality(p_ids) = 0 or to_regclass('public.' || p_table) is null then
    return;
  end if;
  for ref in
    select src.oid as src_oid, src.relname as src_table, att.attname as src_column
    from pg_constraint constraint_row
    join pg_class src on src.oid = constraint_row.conrelid
    join pg_namespace src_schema on src_schema.oid = src.relnamespace
    join lateral unnest(constraint_row.conkey, constraint_row.confkey) as cols(src_attnum, ref_attnum) on true
    join pg_attribute att on att.attrelid = src.oid and att.attnum = cols.src_attnum
    join pg_attribute referenced on referenced.attrelid = constraint_row.confrelid and referenced.attnum = cols.ref_attnum
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = to_regclass('public.' || p_table)
      and src_schema.nspname = 'public'
      and referenced.attname = 'id'
      and not app_private.restore_table_in_backup(src.relname, p_include_pro)
  loop
    select exists (
      select 1 from pg_attribute column_row
      where column_row.attrelid = ref.src_oid and column_row.attname = 'organization_id' and column_row.attnum > 0 and not column_row.attisdropped
    ) into has_org;
    if has_org then
      execute format('select count(*)::int from public.%I where organization_id = $2 and %I = any($1)', ref.src_table, ref.src_column)
        into found_count using p_ids, p_organization_id;
    else
      execute format('select count(*)::int from public.%I where %I = any($1)', ref.src_table, ref.src_column)
        into found_count using p_ids;
    end if;
    if found_count > 0 then
      totals := jsonb_set(
        totals,
        array[app_private.restore_external_module(ref.src_table)],
        to_jsonb(coalesce((totals->>app_private.restore_external_module(ref.src_table))::int, 0) + found_count)
      );
    end if;
  end loop;
  if totals <> '{}'::jsonb then
    select string_agg(item.key || '|' || item.value, '|' order by item.key)
      into detail
    from jsonb_each_text(totals) item;
    raise exception 'RESTORE_BLOCKED|%|23503|%', p_table, detail using errcode = '23503';
  end if;
end;
$reject$;
revoke all on function app_private.restore_reject_external_refs(uuid, text, uuid[], boolean) from public, anon, authenticated;

create or replace function app_private.restore_detach_inbound_fks(
  p_organization_id uuid,
  p_table text,
  p_ids uuid[],
  p_depth integer default 0,
  p_include_pro boolean default false
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
  perform app_private.restore_reject_external_refs(p_organization_id, p_table, p_ids, p_include_pro);
  for ref in
    select src.oid as src_oid, src.relname as src_table, att.attname as src_column,
      att.attnotnull as src_not_null, att.attgenerated <> '' as src_generated
    from pg_constraint constraint_row
    join pg_class src on src.oid = constraint_row.conrelid
    join pg_namespace src_schema on src_schema.oid = src.relnamespace
    join pg_attribute att on att.attrelid = constraint_row.conrelid and att.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = to_regclass('public.' || p_table)
      and src_schema.nspname = 'public'
      and constraint_row.confdeltype in ('a', 'r')
      and cardinality(constraint_row.conkey) = 1
      and app_private.restore_table_in_backup(src.relname, p_include_pro)
  loop
    select exists (
      select 1 from pg_attribute column_row
      where column_row.attrelid = ref.src_oid and column_row.attname = 'organization_id' and column_row.attnum > 0 and not column_row.attisdropped
    ), exists (
      select 1 from pg_attribute column_row
      where column_row.attrelid = ref.src_oid and column_row.attname = 'id' and column_row.attnum > 0 and not column_row.attisdropped
    ) into has_org, has_id;
    if ref.src_generated or ref.src_not_null then
      if has_id then
        if has_org then
          execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column)
            into ref_ids using p_organization_id, p_ids;
        else
          execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where %I = any($1)', ref.src_table, ref.src_column)
            into ref_ids using p_ids;
        end if;
        perform app_private.restore_detach_inbound_fks(p_organization_id, ref.src_table, ref_ids, p_depth + 1, p_include_pro);
      end if;
      if has_org then
        execute format('delete from public.%I where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column) using p_organization_id, p_ids;
      else
        execute format('delete from public.%I where %I = any($1)', ref.src_table, ref.src_column) using p_ids;
      end if;
    else
      if has_org then
        execute format('update public.%I set %I = null where organization_id = $1 and %I = any($2)', ref.src_table, ref.src_column, ref.src_column) using p_organization_id, p_ids;
      else
        execute format('update public.%I set %I = null where %I = any($1)', ref.src_table, ref.src_column, ref.src_column) using p_ids;
      end if;
    end if;
  end loop;
end;
$detach$;
revoke all on function app_private.restore_detach_inbound_fks(uuid, text, uuid[], integer, boolean) from public, anon, authenticated;
drop function if exists app_private.restore_reject_external_refs(uuid, text, uuid[]);
drop function if exists app_private.restore_detach_inbound_fks(uuid, text, uuid[], integer);
drop function if exists app_private.restore_backup_tables();

-- Posted entry: only lettering stays writable. Body starts from migration 147.
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
      if (to_jsonb(new) - array['updated_at']) is distinct from (to_jsonb(old) - array['updated_at']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501';
      end if;
    end if;
  else
    select status into parent_status from public.accounting_entries where id = (to_jsonb(old)->>'entry_id')::uuid;
    if parent_status = 'posted' then
      if tg_op = 'DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501'; end if;
      if (to_jsonb(new) - array['updated_at','lettering_code','lettering_date'])
        is distinct from (to_jsonb(old) - array['updated_at','lettering_code','lettering_date']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode = '42501';
      end if;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$guard$;
revoke all on function app_private.guard_essential_posted_entry() from public, anon, authenticated;

create or replace function app_private.guard_cash_non_negative()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $cash$
declare
  account_kind text;
  current_balance numeric;
  previous_delta numeric := 0;
  next_delta numeric := 0;
  projected numeric;
begin
  if app_private.organization_restore_active(new.organization_id) then
    return new;
  end if;
  select account.account_type, account.current_balance into account_kind, current_balance
  from public.treasury_accounts account
  where account.id = new.treasury_account_id;
  if account_kind is distinct from 'cash' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null and old.treasury_account_id = new.treasury_account_id then
    previous_delta := case
      when old.transaction_type = 'opening_balance' then 0
      when old.direction = 'out' then -old.amount
      else old.amount
    end;
  end if;
  if new.archived_at is null then
    next_delta := case
      when new.transaction_type = 'opening_balance' then 0
      when new.direction = 'out' then -new.amount
      else new.amount
    end;
  end if;
  if next_delta < previous_delta then
    projected := coalesce(current_balance, 0) - previous_delta + next_delta;
    if projected < 0 or coalesce(current_balance, 0) < 0 then
      raise exception 'CASH_NEGATIVE_BALANCE' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$cash$;
revoke all on function app_private.guard_cash_non_negative() from public, anon, authenticated;
drop trigger if exists cash_non_negative on public.treasury_transactions;
create trigger cash_non_negative
before insert or update on public.treasury_transactions
for each row execute function app_private.guard_cash_non_negative();

create or replace function app_private.refresh_restored_invoice_status(
  p_organization_id uuid,
  p_table text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $status$
declare
  today date := (clock_timestamp() at time zone 'Africa/Casablanca')::date;
begin
  if p_table = 'customer_invoices' then
    update public.customer_invoices invoice
    set payment_status = case
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) <= 0 then 'unpaid'
          when greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          else 'partial'
        end,
        status = case
          when invoice.status in ('draft', 'cancelled') then invoice.status
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0
            and greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0 then 'partially_paid'
          when invoice.due_date is not null and invoice.due_date < today then 'overdue'
          when invoice.status = 'sent' then 'sent'
          else 'validated'
        end
    where invoice.organization_id = p_organization_id
      and invoice.id in (
        select (elem->>'id')::uuid from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem where elem->>'id' is not null
      );
  elsif p_table = 'supplier_invoices' then
    update public.supplier_invoices invoice
    set payment_status = case
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) <= 0 then 'unpaid'
          when greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          else 'partial'
        end,
        status = case
          when invoice.status in ('draft', 'cancelled') then invoice.status
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0
            and greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0 then 'partially_paid'
          else 'validated'
        end
    where invoice.organization_id = p_organization_id
      and invoice.id in (
        select (elem->>'id')::uuid from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem where elem->>'id' is not null
      );
  end if;
end;
$status$;
revoke all on function app_private.refresh_restored_invoice_status(uuid, text, jsonb) from public, anon, authenticated;

create table if not exists public.organization_restore_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restored_by uuid,
  table_name text not null,
  record_id uuid not null,
  document_number text,
  document_status text,
  created_at timestamptz not null default now()
);
create index if not exists organization_restore_audit_org_idx on public.organization_restore_audit (organization_id, created_at desc);
alter table public.organization_restore_audit enable row level security;
drop policy if exists organization_restore_audit_admin_read on public.organization_restore_audit;
create policy organization_restore_audit_admin_read on public.organization_restore_audit
for select to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    join public.roles member_role on member_role.id = member.role_id
    where member.user_id = auth.uid()
      and member.organization_id = organization_restore_audit.organization_id
      and member.status = 'active'
      and lower(coalesce(member_role.name, '')) in ('owner', 'admin', 'administrator', 'administrateur')
  )
);
revoke all on public.organization_restore_audit from public, anon, authenticated;
grant select on public.organization_restore_audit to authenticated;

create table if not exists public.commercial_document_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_table text not null,
  document_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  document_on date,
  primary key (organization_id, document_table, document_id)
);
alter table public.commercial_document_usage add column if not exists document_on date;

create or replace function app_private.guard_commercial_document_quota()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $quota$
declare
  plan text;
  max_docs integer;
  used_created bigint;
  used_dated bigint;
  document_on date;
  created_month timestamptz;
  dated_month date;
  payload jsonb := to_jsonb(new);
begin
  if app_private.organization_restore_active(new.organization_id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-quota|' || new.organization_id::text, 0));
  document_on := coalesce(
    nullif(payload->>'invoice_date', '')::date,
    nullif(payload->>'credit_note_date', '')::date,
    nullif(payload->>'document_date', '')::date,
    (clock_timestamp() at time zone 'Africa/Casablanca')::date
  );
  if exists (
    select 1 from public.commercial_document_usage usage
    where usage.organization_id = new.organization_id and usage.document_table = tg_table_name and usage.document_id = new.id
  ) then
    return new;
  end if;
  if auth.uid() is not null then
    if to_regprocedure('app_private.assert_essential_write_access(uuid)') is not null then
      execute 'select app_private.assert_essential_write_access($1)' using new.organization_id;
    end if;
    select subscription.plan_code into plan
    from public.organization_subscriptions subscription
    where subscription.organization_id = new.organization_id
    order by subscription.created_at desc
    limit 1;
    max_docs := case plan when 'premium' then null when 'business' then 3000 else 500 end;
    created_month := date_trunc('month', clock_timestamp() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca';
    dated_month := date_trunc('month', document_on)::date;
    select count(*) into used_created
    from public.commercial_document_usage usage
    where usage.organization_id = new.organization_id
      and usage.created_at >= created_month
      and usage.created_at < (created_month + interval '1 month');
    select count(*) into used_dated
    from public.commercial_document_usage usage
    where usage.organization_id = new.organization_id
      and date_trunc('month', coalesce(usage.document_on, (usage.created_at at time zone 'Africa/Casablanca')::date))::date = dated_month;
    if max_docs is not null and (used_created >= max_docs or used_dated >= max_docs) then
      raise exception 'COMMERCIAL_DOCUMENT_LIMIT_REACHED' using errcode = '23514';
    end if;
  elsif coalesce(current_setting('role', true), 'none') in ('anon', 'authenticated') then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  insert into public.commercial_document_usage(organization_id, document_table, document_id, document_on)
  values (new.organization_id, tg_table_name, new.id, document_on)
  on conflict do nothing;
  return new;
end;
$quota$;
revoke all on function app_private.guard_commercial_document_quota() from public, anon, authenticated;
do $attach$
declare tab text;
begin
  foreach tab in array array['customer_invoices','supplier_invoices','customer_credit_notes','sales_documents','purchase_documents'] loop
    if to_regclass('public.' || tab) is not null then
      execute format('drop trigger if exists ab_commercial_document_quota on public.%I', tab);
      execute format('create trigger ab_commercial_document_quota before insert on public.%I for each row execute function app_private.guard_commercial_document_quota()', tab);
    end if;
  end loop;
end;
$attach$;
create function public.restore_organization_backup_bundle(
  p_organization_id uuid,
  p_mode text,
  p_parent text,
  p_parents jsonb,
  p_child text,
  p_child_key text,
  p_children jsonb,
  p_keep_ids uuid[] default '{}'::uuid[],
  p_confirm text default null,
  p_confirm_name text default null,
  p_include_pro boolean default false
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
    'accounting_entries','hr_departments','hr_positions','hr_employees',
    'warehouses','sales_documents','purchase_documents','stock_moves','stock_levels',
    'customer_reminders','customer_reminder_invoices','bank_statement_imports','bank_statement_lines',
    'bank_reconciliations','bank_reconciliation_groups','bank_reconciliation_group_items'
  ];
  children text[] := array[
    'customer_invoice_lines','supplier_invoice_lines','customer_credit_note_lines','supplier_credit_note_lines',
    'customer_payment_allocations','supplier_payment_allocations','accounting_entry_lines',
    'sales_document_lines','purchase_document_lines'
  ];
  keys text[] := array['entry_id','invoice_id','credit_note_id','payment_id','document_id'];
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
    if p_confirm is distinct from 'oui' or app_private.restore_confirmation_name(p_confirm_name) is distinct from app_private.restore_confirmation_name(organization_name) then
      raise exception 'RESTORE_CONFIRMATION' using errcode = '42501';
    end if;
    if p_parent = any(app_private.restore_pro_tables()) and not p_include_pro then
      raise exception 'RESTORE_TABLE_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if p_mode = 'rehearse' then
    select coalesce(array_agg((elem->>'id')::uuid), '{}'::uuid[]) into parent_ids
    from jsonb_array_elements(coalesce(p_parents, '[]'::jsonb)) elem
    where elem->>'id' is not null;
    if cardinality(parent_ids) > 0 then
      if p_child is not null then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and %I = any($2)', p_child, p_child_key)
          into child_ids using p_organization_id, parent_ids;
        perform app_private.restore_reject_external_refs(p_organization_id, p_child, child_ids, p_include_pro);
      end if;
      perform app_private.restore_reject_external_refs(p_organization_id, p_parent, parent_ids, p_include_pro);
    else
      if p_child is not null then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and not (%I = any($2))', p_child, p_child_key)
          into child_ids using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
        perform app_private.restore_reject_external_refs(p_organization_id, p_child, child_ids, p_include_pro);
      end if;
      if p_parent <> 'company_settings' then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and not (id = any($2))', p_parent)
          into parent_ids using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
        perform app_private.restore_reject_external_refs(p_organization_id, p_parent, parent_ids, p_include_pro);
      end if;
      return jsonb_build_object('ok', true, 'rehearsed', true, 'written', 0);
    end if;
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
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_child, child_ids, 0, p_include_pro);
        execute format('delete from public.%I where organization_id = $1 and not (%I = any($2))', p_child, p_child_key)
          using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
      end if;
      if p_parent <> 'company_settings' then
        execute format('select coalesce(array_agg(id), ''{}''::uuid[]) from public.%I where organization_id = $1 and not (id = any($2))', p_parent)
          into parent_ids using p_organization_id, coalesce(p_keep_ids, '{}'::uuid[]);
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_parent, parent_ids, 0, p_include_pro);
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
        perform app_private.restore_detach_inbound_fks(p_organization_id, p_child, child_ids, 0, p_include_pro);
        execute format('delete from public.%I where organization_id = $1 and %I = any($2)', p_child, p_child_key)
          using p_organization_id, parent_ids;
      end if;
      perform app_private.restore_detach_inbound_fks(p_organization_id, p_parent, parent_ids, 0, p_include_pro);
      execute format('delete from public.%I where organization_id = $1 and id = any($2)', p_parent)
        using p_organization_id, parent_ids;
    end if;

    if p_mode in ('merge', 'replace') then
      perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_parent, coalesce(p_parents, '[]'::jsonb), '{}'::uuid[]);
      if p_child is not null then
        perform public.restore_organization_backup_batch(p_organization_id, 'merge', p_child, coalesce(p_children, '[]'::jsonb), '{}'::uuid[]);
      end if;
    end if;

    if p_mode in ('merge', 'replace') and p_parent in ('customer_invoices', 'supplier_invoices') then
      perform app_private.refresh_restored_invoice_status(p_organization_id, p_parent, coalesce(p_parents, '[]'::jsonb));
      insert into public.organization_restore_audit(organization_id, restored_by, table_name, record_id, document_number, document_status)
      select p_organization_id, auth.uid(), p_parent, (elem->>'id')::uuid,
        coalesce(elem->>'invoice_number', elem->>'supplier_invoice_number'), elem->>'status'
      from jsonb_array_elements(coalesce(p_parents, '[]'::jsonb)) elem
      where coalesce(elem->>'status', '') not in ('', 'draft', 'cancelled')
        and elem->>'id' is not null;
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


revoke all on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text, boolean) from public, anon, authenticated;
grant execute on function public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text, boolean) to authenticated;
drop function if exists public.restore_organization_backup_bundle(uuid, text, text, jsonb, text, text, jsonb, uuid[], text, text);

create or replace function public.restore_organization_backup_batch(
  p_organization_id uuid,
  p_mode text,
  p_table text,
  p_rows jsonb default '[]'::jsonb,
  p_fresh_invoice_ids uuid[] default '{}'::uuid[],
  p_confirm text default null,
  p_confirm_name text default null
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
    'accounting_entries','accounting_entry_lines','hr_departments','hr_positions','hr_employees',
    'warehouses','sales_documents','sales_document_lines','purchase_documents','purchase_document_lines',
    'stock_moves','stock_levels','customer_reminders','customer_reminder_invoices',
    'bank_statement_imports','bank_statement_lines','bank_reconciliations',
    'bank_reconciliation_groups','bank_reconciliation_group_items'
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
  organization_name text;
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
  if p_mode = 'delete' then
    select organization_row.name into organization_name from public.organizations organization_row where organization_row.id = p_organization_id;
    if p_confirm is distinct from 'oui' or app_private.restore_confirmation_name(p_confirm_name) is distinct from app_private.restore_confirmation_name(organization_name) then
      raise exception 'RESTORE_CONFIRMATION' using errcode = '42501';
    end if;
  end if;
  if to_regclass('public.' || p_table) is null then
    return jsonb_build_object('name', p_table, 'written', 0, 'skipped', 0, 'insertedInvoiceIds', '[]'::jsonb, 'missing', true);
  end if;

  select subscription.plan_code into v_plan
  from public.organization_subscriptions subscription
  where subscription.organization_id = p_organization_id
  order by subscription.created_at desc nulls last
  limit 1;
  if (p_table like 'hr\_%' escape '\' or p_table = any(app_private.restore_pro_tables()))
     and v_plan is not null and lower(v_plan) not in ('premium', 'pro') then
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

revoke all on function public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[], text, text) to authenticated;
drop function if exists public.restore_organization_backup_batch(uuid, text, text, jsonb, uuid[]);
