-- =============================================
-- Migration 004: Commerce Sales Flow Enhancement
-- Adds missing columns to existing commerce tables
-- (sales_quotes, sales_orders, delivery_notes, and their line tables)
-- Preserves all existing data
-- =============================================

-- =============================================
-- Sales Quotes - add contact, financial, and conversion columns
-- =============================================
do $$
begin
  alter table sales_quotes add column if not exists contact_id uuid references contacts(id);
  alter table sales_quotes add column if not exists internal_notes text;
  alter table sales_quotes add column if not exists payment_terms_days integer not null default 0;
  alter table sales_quotes add column if not exists discount_total numeric(14,2) not null default 0;
  alter table sales_quotes add column if not exists subtotal_ht numeric(14,2) not null default 0;
  alter table sales_quotes add column if not exists total_ttc numeric(14,2) not null default 0;
  alter table sales_quotes add column if not exists converted_order_id uuid references sales_orders(id);
  alter table sales_quotes add column if not exists converted_at timestamptz;
end $$;

-- =============================================
-- Sales Quote Lines - add unit, pricing, tax, and ordering columns
-- =============================================
do $$
begin
  alter table sales_quote_lines add column if not exists unit_id uuid references units(id);
  alter table sales_quote_lines add column if not exists unit_price_ht numeric(14,2) not null default 0;
  alter table sales_quote_lines add column if not exists discount_rate numeric(5,2) not null default 0;
  alter table sales_quote_lines add column if not exists tax_rate_id uuid references tax_rates(id);
  alter table sales_quote_lines add column if not exists tax_amount numeric(14,2) not null default 0;
  alter table sales_quote_lines add column if not exists subtotal_ht numeric(14,2) not null default 0;
  alter table sales_quote_lines add column if not exists total_ttc numeric(14,2) not null default 0;
  alter table sales_quote_lines add column if not exists line_order integer not null default 1;
end $$;

-- =============================================
-- Sales Orders - add contact, delivery, financial, and conversion columns
-- =============================================
do $$
begin
  alter table sales_orders add column if not exists contact_id uuid references contacts(id);
  alter table sales_orders add column if not exists expected_delivery_date date;
  alter table sales_orders add column if not exists internal_notes text;
  alter table sales_orders add column if not exists payment_terms_days integer not null default 0;
  alter table sales_orders add column if not exists discount_total numeric(14,2) not null default 0;
  alter table sales_orders add column if not exists subtotal_ht numeric(14,2) not null default 0;
  alter table sales_orders add column if not exists total_ttc numeric(14,2) not null default 0;
  alter table sales_orders add column if not exists delivered_total numeric(14,2) not null default 0;
  alter table sales_orders add column if not exists converted_at timestamptz;
end $$;

-- =============================================
-- Sales Order Lines - add quote link, unit, pricing, tax, delivery, and ordering columns
-- =============================================
do $$
begin
  alter table sales_order_lines add column if not exists quote_line_id uuid references sales_quote_lines(id);
  alter table sales_order_lines add column if not exists unit_id uuid references units(id);
  alter table sales_order_lines add column if not exists unit_price_ht numeric(14,2) not null default 0;
  alter table sales_order_lines add column if not exists discount_rate numeric(5,2) not null default 0;
  alter table sales_order_lines add column if not exists tax_rate_id uuid references tax_rates(id);
  alter table sales_order_lines add column if not exists tax_amount numeric(14,2) not null default 0;
  alter table sales_order_lines add column if not exists delivered_quantity numeric(14,3) not null default 0;
  alter table sales_order_lines add column if not exists subtotal_ht numeric(14,2) not null default 0;
  alter table sales_order_lines add column if not exists total_ttc numeric(14,2) not null default 0;
  alter table sales_order_lines add column if not exists line_order integer not null default 1;
end $$;

-- =============================================
-- Delivery Notes - add contact, address, and notes columns
-- =============================================
do $$
begin
  alter table delivery_notes add column if not exists contact_id uuid references contacts(id);
  alter table delivery_notes add column if not exists delivery_number text;
  alter table delivery_notes add column if not exists delivery_address text;
  alter table delivery_notes add column if not exists internal_notes text;
end $$;

-- =============================================
-- Delivery Note Lines - add order link, unit, delivered qty, and ordering columns
-- =============================================
do $$
begin
  alter table delivery_note_lines add column if not exists order_line_id uuid references sales_order_lines(id);
  alter table delivery_note_lines add column if not exists unit_id uuid references units(id);
  alter table delivery_note_lines add column if not exists delivered_quantity numeric(14,3) not null default 0;
  alter table delivery_note_lines add column if not exists line_order integer not null default 1;
end $$;

-- =============================================
-- Indexes for sales_quotes
-- =============================================
create index if not exists sales_quotes_status_idx on sales_quotes (status);
create index if not exists sales_quotes_document_date_idx on sales_quotes (document_date);
create index if not exists sales_quotes_third_party_idx on sales_quotes (third_party_id);

-- =============================================
-- Indexes for sales_orders
-- =============================================
create index if not exists sales_orders_status_idx on sales_orders (status);
create index if not exists sales_orders_document_date_idx on sales_orders (document_date);

-- =============================================
-- Indexes for delivery_notes
-- =============================================
create index if not exists delivery_notes_status_idx on delivery_notes (status);
create index if not exists delivery_notes_document_date_idx on delivery_notes (document_date);
