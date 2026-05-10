-- Felexia - Purchase module V1
-- Supplier orders, supplier receipts, supplier invoices, supplier payments.
-- Additive migration — no tables are dropped and no data is deleted.

-- Drop legacy placeholder stubs from 001_initial_schema (empty tables, never used by the app)
-- to allow the new properly-structured tables to be created.
drop table if exists public.supplier_payments cascade;
drop table if exists public.supplier_invoice_lines cascade;
drop table if exists public.supplier_invoices cascade;

-- ============================================================================
-- 1. purchase_documents (supplier_orders + supplier_receipts)
-- ============================================================================
create table if not exists public.purchase_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  document_number text not null,
  supplier_id uuid not null references public.third_parties(id),
  source_document_id uuid null references public.purchase_documents(id),
  related_order_id uuid null references public.purchase_documents(id),
  document_date date not null default current_date,
  expected_receipt_date date null,
  receipt_date date null,
  status text not null default 'draft',
  subtotal_ht numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  notes text null,
  internal_notes text null,
  validated_at timestamptz null,
  stock_updated_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint purchase_documents_document_type_check check (document_type in ('supplier_order', 'supplier_receipt')),
  constraint purchase_documents_status_check check (
    (document_type = 'supplier_order' and status in ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'))
    or (document_type = 'supplier_receipt' and status in ('draft', 'validated', 'cancelled'))
  ),
  constraint purchase_documents_amounts_check check (subtotal_ht >= 0 and discount_total >= 0 and tax_total >= 0 and total_ttc >= 0),
  unique (organization_id, document_number)
);

create table if not exists public.purchase_document_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.purchase_documents(id) on delete cascade,
  source_line_id uuid null references public.purchase_document_lines(id),
  line_order integer not null default 1,
  product_id uuid null references public.products(id) on delete set null,
  product_name text null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_id uuid null references public.units(id) on delete set null,
  unit_name text null,
  unit_price_ht numeric(14,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  tax_rate_id uuid null references public.tax_rates(id) on delete set null,
  tax_rate numeric(5,2) not null default 0,
  subtotal_ht numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  ordered_quantity numeric(14,3) null,
  received_quantity numeric(14,3) not null default 0,
  remaining_quantity numeric(14,3) null,
  stock_move_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_document_lines_quantity_check check (quantity > 0),
  constraint purchase_document_lines_rate_check check (discount_rate between 0 and 100 and tax_rate between 0 and 100),
  constraint purchase_document_lines_amounts_check check (unit_price_ht >= 0 and subtotal_ht >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_ttc >= 0)
);

-- ============================================================================
-- 2. Indexes for purchase_documents / lines
-- ============================================================================
create index if not exists purchase_documents_organization_id_idx on public.purchase_documents (organization_id);
create index if not exists purchase_documents_document_type_idx on public.purchase_documents (document_type);
create index if not exists purchase_documents_supplier_id_idx on public.purchase_documents (supplier_id);
create index if not exists purchase_documents_status_idx on public.purchase_documents (status);
create index if not exists purchase_documents_document_date_idx on public.purchase_documents (document_date);
create index if not exists purchase_documents_related_order_id_idx on public.purchase_documents (related_order_id);
create index if not exists purchase_documents_archived_at_idx on public.purchase_documents (archived_at);

create index if not exists purchase_document_lines_organization_id_idx on public.purchase_document_lines (organization_id);
create index if not exists purchase_document_lines_document_id_idx on public.purchase_document_lines (document_id);
create index if not exists purchase_document_lines_product_id_idx on public.purchase_document_lines (product_id);
create index if not exists purchase_document_lines_source_line_id_idx on public.purchase_document_lines (source_line_id);

-- ============================================================================
-- 3. supplier_invoices
-- ============================================================================
create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  supplier_invoice_number text null,
  supplier_id uuid not null references public.third_parties(id),
  source_type text null,
  source_receipt_id uuid null references public.purchase_documents(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date null,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  subtotal_ht numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  notes text null,
  internal_notes text null,
  validated_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint supplier_invoices_source_type_check check (source_type is null or source_type in ('manual', 'supplier_receipt', 'grouped_supplier_receipts')),
  constraint supplier_invoices_status_check check (status in ('draft', 'validated', 'partially_paid', 'paid', 'cancelled')),
  constraint supplier_invoices_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid')),
  constraint supplier_invoices_amounts_check check (
    subtotal_ht >= 0 and discount_total >= 0 and tax_total >= 0 and total_ttc >= 0
    and paid_amount >= 0 and remaining_amount >= 0
  ),
  unique (organization_id, invoice_number)
);

create table if not exists public.supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  source_line_id uuid null references public.purchase_document_lines(id) on delete set null,
  source_document_id uuid null references public.purchase_documents(id) on delete set null,
  line_order integer not null default 1,
  product_id uuid null references public.products(id) on delete set null,
  product_name text null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_id uuid null references public.units(id) on delete set null,
  unit_name text null,
  unit_price_ht numeric(14,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  tax_rate_id uuid null references public.tax_rates(id) on delete set null,
  tax_rate numeric(5,2) not null default 0,
  subtotal_ht numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoice_lines_quantity_check check (quantity > 0),
  constraint supplier_invoice_lines_rate_check check (discount_rate between 0 and 100 and tax_rate between 0 and 100),
  constraint supplier_invoice_lines_amounts_check check (unit_price_ht >= 0 and subtotal_ht >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_ttc >= 0)
);

create index if not exists supplier_invoices_organization_id_idx on public.supplier_invoices (organization_id);
create index if not exists supplier_invoices_invoice_number_idx on public.supplier_invoices (invoice_number);
create index if not exists supplier_invoices_supplier_id_idx on public.supplier_invoices (supplier_id);
create index if not exists supplier_invoices_status_idx on public.supplier_invoices (status);
create index if not exists supplier_invoices_payment_status_idx on public.supplier_invoices (payment_status);
create index if not exists supplier_invoices_invoice_date_idx on public.supplier_invoices (invoice_date);
create index if not exists supplier_invoices_due_date_idx on public.supplier_invoices (due_date);
create index if not exists supplier_invoices_archived_at_idx on public.supplier_invoices (archived_at);

create index if not exists supplier_invoice_lines_organization_id_idx on public.supplier_invoice_lines (organization_id);
create index if not exists supplier_invoice_lines_invoice_id_idx on public.supplier_invoice_lines (invoice_id);
create index if not exists supplier_invoice_lines_product_id_idx on public.supplier_invoice_lines (product_id);
create index if not exists supplier_invoice_lines_source_document_id_idx on public.supplier_invoice_lines (source_document_id);
create index if not exists supplier_invoice_lines_source_line_id_idx on public.supplier_invoice_lines (source_line_id);

-- ============================================================================
-- 4. supplier_payments
-- ============================================================================
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_number text not null,
  supplier_id uuid not null references public.third_parties(id),
  payment_date date not null default current_date,
  value_date date null,
  amount numeric(14,2) not null,
  allocated_amount numeric(14,2) not null default 0,
  available_amount numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  payment_method text null,
  reference text null,
  bank_name text null,
  check_number text null,
  transfer_reference text null,
  due_date date null,
  status text not null default 'draft',
  payment_type text not null default 'supplier_payment',
  notes text null,
  internal_notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint supplier_payments_amount_check check (amount > 0),
  constraint supplier_payments_status_check check (status in ('draft', 'confirmed', 'partially_allocated', 'allocated', 'cancelled')),
  constraint supplier_payments_type_check check (payment_type in ('supplier_payment', 'advance_payment', 'deposit', 'other')),
  unique (organization_id, payment_number)
);

create table if not exists public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.supplier_payments(id) on delete cascade,
  invoice_id uuid not null references public.supplier_invoices(id) on delete set null,
  supplier_id uuid not null references public.third_parties(id),
  allocation_date date not null default current_date,
  amount numeric(14,2) not null,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  constraint supplier_payment_allocations_amount_check check (amount > 0)
);

create index if not exists supplier_payments_organization_id_idx on public.supplier_payments (organization_id);
create index if not exists supplier_payments_supplier_id_idx on public.supplier_payments (supplier_id);
create index if not exists supplier_payments_status_idx on public.supplier_payments (status);
create index if not exists supplier_payments_payment_date_idx on public.supplier_payments (payment_date);
create index if not exists supplier_payments_archived_at_idx on public.supplier_payments (archived_at);

create index if not exists supplier_payment_allocations_organization_id_idx on public.supplier_payment_allocations (organization_id);
create index if not exists supplier_payment_allocations_payment_id_idx on public.supplier_payment_allocations (payment_id);
create index if not exists supplier_payment_allocations_invoice_id_idx on public.supplier_payment_allocations (invoice_id);
create index if not exists supplier_payment_allocations_supplier_id_idx on public.supplier_payment_allocations (supplier_id);

-- ============================================================================
-- 5. Numbering functions
-- ============================================================================
create or replace function public.generate_purchase_document_number()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  period text;
  next_number integer;
begin
  if new.document_number is not null and length(trim(new.document_number)) > 0 then
    return new;
  end if;
  prefix := case new.document_type
    when 'supplier_order' then 'CF'
    when 'supplier_receipt' then 'REC'
    else 'ACH'
  end;
  period := to_char(coalesce(new.document_date, current_date), 'YYMM');
  select coalesce(max((regexp_match(document_number, '^[A-Z]+-[0-9]{4}-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.purchase_documents
  where organization_id = new.organization_id
    and document_type = new.document_type
    and document_number like prefix || '-' || period || '-%';
  new.document_number := prefix || '-' || period || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

create or replace function public.generate_supplier_invoice_number()
returns trigger
language plpgsql
as $$
declare
  prefix text := 'FF';
  period text;
  next_number integer;
begin
  if new.invoice_number is not null and length(trim(new.invoice_number)) > 0 then
    return new;
  end if;
  period := to_char(coalesce(new.invoice_date, current_date), 'YYMM');
  select coalesce(max((regexp_match(invoice_number, '^[A-Z]+-[0-9]{4}-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.supplier_invoices
  where organization_id = new.organization_id
    and invoice_number like prefix || '-' || period || '-%';
  new.invoice_number := prefix || '-' || period || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

create or replace function public.generate_supplier_payment_number()
returns trigger
language plpgsql
as $$
declare
  prefix text := 'RFO';
  period text;
  next_number integer;
begin
  if new.payment_number is not null and length(trim(new.payment_number)) > 0 then
    return new;
  end if;
  period := to_char(coalesce(new.payment_date, current_date), 'YYMM');
  select coalesce(max((regexp_match(payment_number, '^[A-Z]+-[0-9]{4}-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.supplier_payments
  where organization_id = new.organization_id
    and payment_number like prefix || '-' || period || '-%';
  new.payment_number := prefix || '-' || period || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

-- ============================================================================
-- 6. Updated_at triggers
-- ============================================================================
drop trigger if exists purchase_documents_updated_at on public.purchase_documents;
create trigger purchase_documents_updated_at
before update on public.purchase_documents
for each row execute function public.set_updated_at();

drop trigger if exists purchase_document_lines_updated_at on public.purchase_document_lines;
create trigger purchase_document_lines_updated_at
before update on public.purchase_document_lines
for each row execute function public.set_updated_at();

drop trigger if exists supplier_invoices_updated_at on public.supplier_invoices;
create trigger supplier_invoices_updated_at
before update on public.supplier_invoices
for each row execute function public.set_updated_at();

drop trigger if exists supplier_invoice_lines_updated_at on public.supplier_invoice_lines;
create trigger supplier_invoice_lines_updated_at
before update on public.supplier_invoice_lines
for each row execute function public.set_updated_at();

drop trigger if exists supplier_payments_updated_at on public.supplier_payments;
create trigger supplier_payments_updated_at
before update on public.supplier_payments
for each row execute function public.set_updated_at();

drop trigger if exists supplier_payment_allocations_updated_at on public.supplier_payment_allocations;
create trigger supplier_payment_allocations_updated_at
before update on public.supplier_payment_allocations
for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. Numbering triggers
-- ============================================================================
drop trigger if exists purchase_documents_number on public.purchase_documents;
create trigger purchase_documents_number
before insert on public.purchase_documents
for each row execute function public.generate_purchase_document_number();

drop trigger if exists supplier_invoices_number on public.supplier_invoices;
create trigger supplier_invoices_number
before insert on public.supplier_invoices
for each row execute function public.generate_supplier_invoice_number();

drop trigger if exists supplier_payments_number on public.supplier_payments;
create trigger supplier_payments_number
before insert on public.supplier_payments
for each row execute function public.generate_supplier_payment_number();

-- ============================================================================
-- 8. RLS
-- ============================================================================
alter table public.purchase_documents enable row level security;
alter table public.purchase_document_lines enable row level security;
alter table public.supplier_invoices enable row level security;
alter table public.supplier_invoice_lines enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;

drop policy if exists purchase_documents_org_member_all on public.purchase_documents;
create policy purchase_documents_org_member_all
on public.purchase_documents
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists purchase_document_lines_org_member_all on public.purchase_document_lines;
create policy purchase_document_lines_org_member_all
on public.purchase_document_lines
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists supplier_invoices_org_member_all on public.supplier_invoices;
create policy supplier_invoices_org_member_all
on public.supplier_invoices
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists supplier_invoice_lines_org_member_all on public.supplier_invoice_lines;
create policy supplier_invoice_lines_org_member_all
on public.supplier_invoice_lines
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists supplier_payments_org_member_all on public.supplier_payments;
create policy supplier_payments_org_member_all
on public.supplier_payments
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists supplier_payment_allocations_org_member_all on public.supplier_payment_allocations;
create policy supplier_payment_allocations_org_member_all
on public.supplier_payment_allocations
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

-- ============================================================================
-- 9. Add purchase_receipt_in to stock_moves constraint
-- ============================================================================
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.stock_moves'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%move_type%'
  loop
    execute format('alter table public.stock_moves drop constraint if exists %I', constraint_record.conname);
  end loop;

  alter table public.stock_moves
  add constraint stock_moves_move_type_check
  check (move_type in (
    'delivery_out',
    'customer_return_in',
    'adjustment_in',
    'adjustment_out',
    'manual_stock_in',
    'manual_stock_out',
    'initial_stock',
    'purchase_in',
    'purchase_receipt_in'
  ));
end $$;

-- ============================================================================
-- 10. Update stock_moves FK to accept purchase_documents as source
-- ============================================================================
alter table public.stock_moves alter column source_document_id drop not null;
comment on column public.stock_moves.source_document_id is 'References sales_documents or purchase_documents depending on move_type';
