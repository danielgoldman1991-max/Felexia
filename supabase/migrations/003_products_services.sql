-- =============================================
-- Migration 003: Products & Services extension
-- Adds columns to existing tables from 001
-- Preserves all existing data
-- =============================================

-- Extend product_categories
alter table product_categories add column if not exists description text;
alter table product_categories add column if not exists parent_id uuid references product_categories(id);
alter table product_categories add column if not exists type text not null default 'mixed' check (type in ('product', 'service', 'mixed'));
alter table product_categories add column if not exists status text not null default 'active' check (status in ('active', 'archived'));
alter table product_categories add column if not exists archived_at timestamptz;
alter table product_categories add column if not exists created_by uuid references profiles(id);

drop index if exists product_categories_organization_id_idx;
create index if not exists product_categories_organization_id_idx on product_categories (organization_id);
create index if not exists product_categories_status_idx on product_categories (status);
create index if not exists product_categories_type_idx on product_categories (type);
create index if not exists product_categories_archived_at_idx on product_categories (archived_at);

-- Extend units
alter table units add column if not exists description text;
alter table units add column if not exists status text not null default 'active' check (status in ('active', 'archived'));
alter table units add column if not exists archived_at timestamptz;
alter table units add column if not exists created_by uuid references profiles(id);

drop index if exists units_organization_id_idx;
create index if not exists units_organization_id_idx on units (organization_id);
create index if not exists units_status_idx on units (status);
create index if not exists units_archived_at_idx on units (archived_at);

-- Extend tax_rates
alter table tax_rates add column if not exists description text;
alter table tax_rates add column if not exists status text not null default 'active' check (status in ('active', 'archived'));
alter table tax_rates add column if not exists archived_at timestamptz;
alter table tax_rates add column if not exists created_by uuid references profiles(id);

drop index if exists tax_rates_organization_id_idx;
create index if not exists tax_rates_organization_id_idx on tax_rates (organization_id);
create index if not exists tax_rates_status_idx on tax_rates (status);
create index if not exists tax_rates_archived_at_idx on tax_rates (archived_at);

-- Extend products
alter table products add column if not exists barcode text;
alter table products add column if not exists purchase_price_ht numeric(14,2) not null default 0 check (purchase_price_ht >= 0);
alter table products add column if not exists sale_price_ht numeric(14,2) not null default 0 check (sale_price_ht >= 0);
alter table products add column if not exists sale_price_ttc numeric(14,2) not null default 0 check (sale_price_ttc >= 0);
alter table products add column if not exists margin_amount numeric(14,2) not null default 0;
alter table products add column if not exists margin_rate numeric(7,2) not null default 0;
alter table products add column if not exists current_stock numeric(14,3) not null default 0 check (current_stock >= 0);
alter table products add column if not exists stock_alert_enabled boolean not null default false;
alter table products add column if not exists default_discount_rate numeric(5,2) not null default 0 check (default_discount_rate >= 0 and default_discount_rate <= 100);
alter table products add column if not exists is_sellable boolean not null default true;
alter table products add column if not exists is_purchasable boolean not null default true;
alter table products add column if not exists notes text;
alter table products add column if not exists updated_at timestamptz not null default now();

-- Copy existing price data into new columns
update products set purchase_price_ht = purchase_price where purchase_price_ht = 0 and purchase_price > 0;
update products set sale_price_ht = sale_price where sale_price_ht = 0 and sale_price > 0;

-- Add unique indexes for barcode and sku (non-archived only)
create unique index if not exists products_organization_id_sku_unique on products (organization_id, sku) where archived_at is null;
drop index if exists products_organization_id_sku_key;
drop index if exists products_sku_key;
drop index if exists products_organization_id_sku_idx;

create unique index if not exists products_organization_id_barcode_unique on products (organization_id, barcode) where barcode is not null and archived_at is null;

-- Indexes for products
drop index if exists products_organization_id_idx;
create index if not exists products_organization_id_idx on products (organization_id);
create index if not exists products_status_idx on products (status);
create index if not exists products_type_idx on products (type);
create index if not exists products_category_id_idx on products (category_id);
create index if not exists products_tax_rate_id_idx on products (tax_rate_id);
create index if not exists products_archived_at_idx on products (archived_at);
create index if not exists products_barcode_idx on products (barcode);

-- Update RLS policies (migration 001 already has org_member policies for all tables)
-- Ensure product_categories, units, tax_rates, products have proper RLS
alter table product_categories enable row level security;
alter table units enable row level security;
alter table tax_rates enable row level security;

-- Create or replace policies (safe to re-run)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'product_categories_org_member_all') then
    create policy product_categories_org_member_all on product_categories
      for all using (app_private.is_org_member(organization_id)) with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'units_org_member_all') then
    create policy units_org_member_all on units
      for all using (app_private.is_org_member(organization_id)) with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_org_member_all') then
    create policy tax_rates_org_member_all on tax_rates
      for all using (app_private.is_org_member(organization_id)) with check (app_private.is_org_member(organization_id));
  end if;
end $$;
