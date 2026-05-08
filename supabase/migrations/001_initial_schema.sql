create extension if not exists pgcrypto;
create schema if not exists app_private;

do $$ begin
  create type third_party_type as enum ('customer', 'supplier', 'both');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type product_type as enum ('product', 'service');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type document_status as enum (
    'draft', 'sent', 'accepted', 'rejected', 'expired', 'converted',
    'confirmed', 'partially_delivered', 'delivered', 'partially_invoiced',
    'invoiced', 'partially_received', 'received', 'partially_paid', 'paid',
    'overdue', 'cancelled', 'credited', 'validated'
  );
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type payment_status as enum ('draft', 'confirmed', 'cancelled');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type stock_move_type as enum ('in', 'out', 'adjustment');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type cash_transaction_type as enum ('in', 'out');
exception
  when duplicate_object then null;
end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid references roles(id),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists company_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  legal_name text not null,
  commercial_name text,
  ice text,
  if_number text,
  rc text,
  tp text,
  cnss text,
  address text,
  city text default 'Casablanca',
  country text default 'Maroc',
  currency text not null default 'MAD',
  default_payment_terms_days integer not null default 30 check (default_payment_terms_days >= 0),
  e_invoicing_ready jsonb not null default '{"dgi_integration": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists numbering_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_type text not null,
  prefix text not null,
  current_year integer not null default extract(year from now())::integer,
  next_number integer not null default 1 check (next_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_type, current_year)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references profiles(id),
  table_name text not null,
  record_id uuid,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

create table if not exists third_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type third_party_type not null,
  name text not null,
  commercial_name text,
  ice text,
  if_number text,
  rc text,
  tp text,
  cnss text,
  email text,
  phone text,
  whatsapp text,
  address text,
  city text,
  country text default 'Maroc',
  payment_terms_days integer default 30 check (payment_terms_days >= 0),
  credit_limit numeric(14,2) default 0 check (credit_limit >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  third_party_id uuid not null references third_parties(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  symbol text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, symbol)
);

create table if not exists tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  rate numeric(5,2) not null check (rate >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type product_type not null,
  sku text,
  name text not null,
  description text,
  category_id uuid references product_categories(id),
  unit_id uuid references units(id),
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  tax_rate_id uuid references tax_rates(id),
  track_stock boolean not null default false,
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, sku)
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists stock_levels (
  organization_id uuid not null references organizations(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, warehouse_id, product_id)
);

create table if not exists sales_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text,
  third_party_id uuid not null references third_parties(id),
  document_date date not null default current_date,
  valid_until date,
  status document_status not null default 'draft',
  currency text not null default 'MAD',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, number)
);

create table if not exists sales_quote_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  quote_id uuid not null references sales_quotes(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 20 check (tax_rate >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0)
);

create table if not exists sales_orders (like sales_quotes including defaults including constraints including indexes);
alter table sales_orders add column if not exists quote_id uuid references sales_quotes(id);
do $$ begin alter table sales_orders rename column valid_until to due_date; exception when undefined_column then null; end $$;
do $$ begin alter table sales_orders drop constraint if exists sales_orders_unique_number; alter table sales_orders add constraint sales_orders_unique_number unique (organization_id, number); end $$;

create table if not exists sales_order_lines (like sales_quote_lines including defaults including constraints including indexes);
do $$ begin alter table sales_order_lines rename column quote_id to order_id; exception when undefined_column then null; end $$;
do $$ begin alter table sales_order_lines add constraint sales_order_lines_order_fk foreign key (order_id) references sales_orders(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists delivery_notes (like sales_quotes including defaults including constraints including indexes);
alter table delivery_notes add column if not exists order_id uuid references sales_orders(id);
do $$ begin alter table delivery_notes rename column valid_until to delivered_at; exception when undefined_column then null; end $$;
do $$ begin alter table delivery_notes add constraint delivery_notes_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists delivery_note_lines (like sales_quote_lines including defaults including constraints including indexes);
do $$ begin alter table delivery_note_lines rename column quote_id to delivery_note_id; exception when undefined_column then null; end $$;
do $$ begin alter table delivery_note_lines add constraint delivery_note_lines_note_fk foreign key (delivery_note_id) references delivery_notes(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists sales_invoices (like sales_quotes including defaults including constraints including indexes);
alter table sales_invoices add column if not exists order_id uuid references sales_orders(id);
alter table sales_invoices add column if not exists due_date date;
alter table sales_invoices add column if not exists paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0);
do $$ begin alter table sales_invoices rename column valid_until to sent_at; exception when undefined_column then null; end $$;
do $$ begin alter table sales_invoices add constraint sales_invoices_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists sales_invoice_lines (like sales_quote_lines including defaults including constraints including indexes);
do $$ begin alter table sales_invoice_lines rename column quote_id to invoice_id; exception when undefined_column then null; end $$;
do $$ begin alter table sales_invoice_lines add constraint sales_invoice_lines_invoice_fk foreign key (invoice_id) references sales_invoices(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text,
  third_party_id uuid not null references third_parties(id),
  invoice_id uuid references sales_invoices(id),
  payment_date date not null default current_date,
  status payment_status not null default 'draft',
  method text,
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table if not exists payment_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references sales_invoices(id),
  reminder_date date not null,
  status text not null default 'planned' check (status in ('planned', 'sent', 'cancelled')),
  channel text default 'email',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_orders (like sales_quotes including defaults including constraints including indexes);
do $$ begin alter table purchase_orders rename column valid_until to expected_date; exception when undefined_column then null; end $$;
do $$ begin alter table purchase_orders add constraint purchase_orders_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;
create table if not exists purchase_order_lines (like sales_quote_lines including defaults including constraints including indexes);
do $$ begin alter table purchase_order_lines rename column quote_id to purchase_order_id; exception when undefined_column then null; end $$;
do $$ begin alter table purchase_order_lines add constraint purchase_order_lines_order_fk foreign key (purchase_order_id) references purchase_orders(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists goods_receipts (like delivery_notes including defaults including constraints including indexes);
alter table goods_receipts add column if not exists purchase_order_id uuid references purchase_orders(id);
do $$ begin alter table goods_receipts add constraint goods_receipts_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;
create table if not exists goods_receipt_lines (like delivery_note_lines including defaults including constraints including indexes);
do $$ begin alter table goods_receipt_lines rename column delivery_note_id to goods_receipt_id; exception when undefined_column then null; end $$;
do $$ begin alter table goods_receipt_lines add constraint goods_receipt_lines_receipt_fk foreign key (goods_receipt_id) references goods_receipts(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists supplier_invoices (like sales_invoices including defaults including constraints including indexes);
alter table supplier_invoices add column if not exists purchase_order_id uuid references purchase_orders(id);
do $$ begin alter table supplier_invoices add constraint supplier_invoices_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;
create table if not exists supplier_invoice_lines (like sales_invoice_lines including defaults including constraints including indexes);
do $$ begin alter table supplier_invoice_lines rename column invoice_id to supplier_invoice_id; exception when undefined_column then null; end $$;
do $$ begin alter table supplier_invoice_lines add constraint supplier_invoice_lines_invoice_fk foreign key (supplier_invoice_id) references supplier_invoices(id) on delete cascade; exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists supplier_payments (like customer_payments including defaults including constraints including indexes);
alter table supplier_payments add column if not exists supplier_invoice_id uuid references supplier_invoices(id);
do $$ begin alter table supplier_payments add constraint supplier_payments_unique_number unique (organization_id, number); exception when duplicate_object then null; when sqlstate '42P07' then null; end $$;

create table if not exists stock_moves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  move_type stock_move_type not null,
  quantity numeric(14,3) not null check (quantity > 0),
  source_document_type text,
  source_document_id uuid,
  move_date timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number text,
  warehouse_id uuid not null references warehouses(id),
  document_date date not null default current_date,
  status document_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table if not exists inventory_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  adjustment_id uuid not null references inventory_adjustments(id) on delete cascade,
  product_id uuid not null references products(id),
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  expected_quantity numeric(14,3) not null default 0 check (expected_quantity >= 0)
);

create table if not exists cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank', 'cash')),
  currency text not null default 'MAD',
  opening_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cash_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cash_account_id uuid not null references cash_accounts(id),
  transaction_date date not null default current_date,
  type cash_transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  label text not null,
  source_document_type text,
  source_document_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists cashflow_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  forecast_date date not null,
  label text not null,
  expected_in numeric(14,2) not null default 0 check (expected_in >= 0),
  expected_out numeric(14,2) not null default 0 check (expected_out >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_org_member(uuid) to authenticated;

create or replace function generate_document_number()
returns trigger language plpgsql as $$
declare
  doc_type text := tg_argv[0];
  seq_prefix text;
  seq_year integer := extract(year from coalesce(new.document_date, current_date))::integer;
  seq_next integer;
begin
  if new.number is not null then
    return new;
  end if;

  select prefix, next_number into seq_prefix, seq_next
  from numbering_sequences
  where organization_id = new.organization_id and document_type = doc_type and current_year = seq_year
  for update;

  if seq_prefix is null then
    seq_prefix := upper(left(doc_type, 3)) || '-';
    seq_next := 1;
    insert into numbering_sequences (organization_id, document_type, prefix, current_year, next_number)
    values (new.organization_id, doc_type, seq_prefix, seq_year, 2);
  else
    update numbering_sequences set next_number = next_number + 1, updated_at = now()
    where organization_id = new.organization_id and document_type = doc_type and current_year = seq_year;
  end if;

  new.number := seq_prefix || seq_year || '-' || lpad(seq_next::text, 4, '0');
  return new;
end;
$$;

create or replace function update_invoice_payment_status()
returns trigger language plpgsql as $$
declare
  invoice_total numeric(14,2);
  paid_total numeric(14,2);
begin
  if new.status <> 'confirmed' or new.invoice_id is null then
    return new;
  end if;

  select total into invoice_total from sales_invoices where id = new.invoice_id;
  select coalesce(sum(amount), 0) into paid_total
  from customer_payments
  where invoice_id = new.invoice_id and status = 'confirmed';

  update sales_invoices
  set paid_amount = paid_total,
      status = case when paid_total >= invoice_total then 'paid'::document_status else 'partially_paid'::document_status end,
      updated_at = now()
  where id = new.invoice_id;

  return new;
end;
$$;

create or replace function update_stock_level()
returns trigger language plpgsql as $$
begin
  insert into stock_levels (organization_id, warehouse_id, product_id, quantity)
  values (
    new.organization_id,
    new.warehouse_id,
    new.product_id,
    case when new.move_type = 'out' then -new.quantity else new.quantity end
  )
  on conflict (organization_id, warehouse_id, product_id)
  do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
  return new;
end;
$$;

create or replace function prevent_validated_document_delete()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'Validated documents cannot be deleted';
  end if;
  return old;
end;
$$;

create or replace function audit_document_change()
returns trigger language plpgsql as $$
begin
  insert into audit_logs (organization_id, actor_id, table_name, record_id, action, changes)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','roles','organization_members','company_settings','numbering_sequences',
    'third_parties','contacts','product_categories','units','tax_rates','products','warehouses',
    'sales_quotes','sales_orders','delivery_notes','sales_invoices','customer_payments','payment_reminders',
    'purchase_orders','goods_receipts','supplier_invoices','supplier_payments','inventory_adjustments',
    'cash_accounts','cashflow_forecasts'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_set_updated_at', t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

drop trigger if exists sales_quotes_number on sales_quotes;
create trigger sales_quotes_number before insert on sales_quotes for each row execute function generate_document_number('DEV');
drop trigger if exists sales_orders_number on sales_orders;
create trigger sales_orders_number before insert on sales_orders for each row execute function generate_document_number('CMD');
drop trigger if exists delivery_notes_number on delivery_notes;
create trigger delivery_notes_number before insert on delivery_notes for each row execute function generate_document_number('BL');
drop trigger if exists sales_invoices_number on sales_invoices;
create trigger sales_invoices_number before insert on sales_invoices for each row execute function generate_document_number('FAC');
drop trigger if exists customer_payments_number on customer_payments;
create trigger customer_payments_number before insert on customer_payments for each row execute function generate_document_number('PAY');
drop trigger if exists customer_payment_updates_invoice on customer_payments;
create trigger customer_payment_updates_invoice after insert or update on customer_payments for each row execute function update_invoice_payment_status();
drop trigger if exists stock_moves_update_level on stock_moves;
create trigger stock_moves_update_level after insert on stock_moves for each row execute function update_stock_level();

do $$
declare t text;
begin
  foreach t in array array['sales_quotes','sales_orders','delivery_notes','sales_invoices','purchase_orders','goods_receipts','supplier_invoices','inventory_adjustments'] loop
    execute format('drop trigger if exists %I on %I', t || '_no_validated_delete', t);
    execute format('create trigger %I_no_validated_delete before delete on %I for each row execute function prevent_validated_document_delete()', t, t);
    execute format('drop trigger if exists %I on %I', t || '_audit', t);
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit_document_change()', t, t);
  end loop;
end $$;

create or replace view view_dashboard_kpis with (security_invoker = true) as
select
  organization_id,
  coalesce(sum(total), 0) as invoiced_revenue,
  coalesce(sum(paid_amount), 0) as collected_amount,
  coalesce(sum(total - paid_amount), 0) as receivable_amount,
  count(*) filter (where status = 'overdue') as overdue_invoices
from sales_invoices
group by organization_id;

create or replace view view_customer_balances with (security_invoker = true) as
select organization_id, third_party_id, sum(total - paid_amount) as balance
from sales_invoices
where status not in ('cancelled', 'credited')
group by organization_id, third_party_id;

create or replace view view_supplier_balances with (security_invoker = true) as
select organization_id, third_party_id, sum(total - paid_amount) as balance
from supplier_invoices
where status not in ('cancelled', 'credited')
group by organization_id, third_party_id;

create or replace view view_stock_status with (security_invoker = true) as
select p.organization_id, p.id as product_id, p.name, coalesce(sum(sl.quantity), 0) as quantity, p.min_stock
from products p
left join stock_levels sl on sl.product_id = p.id and sl.organization_id = p.organization_id
group by p.organization_id, p.id, p.name, p.min_stock;

create or replace view view_sales_margin with (security_invoker = true) as
select sil.organization_id, sum(sil.line_total) as sales_total, sum(sil.quantity * p.purchase_price) as estimated_cost
from sales_invoice_lines sil
left join products p on p.id = sil.product_id
group by sil.organization_id;

do $$
declare t text;
begin
  foreach t in array array[
    'roles','organization_members','company_settings','numbering_sequences','audit_logs',
    'third_parties','contacts','product_categories','units','tax_rates','products','warehouses','stock_levels',
    'sales_quotes','sales_quote_lines','sales_orders','sales_order_lines','delivery_notes','delivery_note_lines',
    'sales_invoices','sales_invoice_lines','customer_payments','payment_reminders','purchase_orders',
    'purchase_order_lines','goods_receipts','goods_receipt_lines','supplier_invoices','supplier_invoice_lines',
    'supplier_payments','stock_moves','inventory_adjustments','inventory_adjustment_lines','cash_accounts',
    'cash_transactions','cashflow_forecasts'
  ] loop
    execute format('create index if not exists %I on %I (organization_id)', t || '_organization_id_idx', t);
  end loop;
end $$;

create index if not exists third_parties_status_idx on third_parties (status);
create index if not exists products_status_idx on products (status);
create index if not exists sales_invoices_status_idx on sales_invoices (status);
create index if not exists sales_invoices_document_date_idx on sales_invoices (document_date);
create index if not exists sales_invoices_due_date_idx on sales_invoices (due_date);
create index if not exists sales_invoices_third_party_idx on sales_invoices (third_party_id);
create index if not exists sales_quotes_document_date_idx on sales_quotes (document_date);
create index if not exists customer_payments_payment_date_idx on customer_payments (payment_date);
create index if not exists stock_moves_move_date_idx on stock_moves (move_date);

alter table profiles enable row level security;
alter table organizations enable row level security;
do $$
declare t text;
begin
  foreach t in array array[
    'roles','organization_members','company_settings','numbering_sequences','audit_logs',
    'third_parties','contacts','product_categories','units','tax_rates','products','warehouses','stock_levels',
    'sales_quotes','sales_quote_lines','sales_orders','sales_order_lines','delivery_notes','delivery_note_lines',
    'sales_invoices','sales_invoice_lines','customer_payments','payment_reminders','purchase_orders',
    'purchase_order_lines','goods_receipts','goods_receipt_lines','supplier_invoices','supplier_invoice_lines',
    'supplier_payments','stock_moves','inventory_adjustments','inventory_adjustment_lines','cash_accounts',
    'cash_transactions','cashflow_forecasts'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_org_member_all', t);
    execute format('create policy %I on %I for all using (app_private.is_org_member(organization_id)) with check (app_private.is_org_member(organization_id))', t || '_org_member_all', t);
  end loop;
end $$;

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select using (id = auth.uid());
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read on organizations for select using (app_private.is_org_member(id));
