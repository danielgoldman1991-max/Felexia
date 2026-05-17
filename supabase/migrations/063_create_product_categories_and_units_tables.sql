-- Migration 063: Create product_categories and units tables for article management
-- This migration creates the missing tables that the code expects but weren't created in migration 052

-- ============================================================
-- 1. product_categories table
-- ============================================================
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text,
  name text not null,
  description text,
  parent_id uuid references product_categories(id),
  type text check (type in ('product', 'service', 'mixed')) default 'mixed',
  status text check (status in ('active', 'archived')) default 'active',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid references auth.users(id)
);

-- Unique constraint for upsert operations
alter table product_categories drop constraint if exists product_categories_org_name_key;
alter table product_categories add constraint product_categories_org_name_key unique (organization_id, name);

-- Case-insensitive unique index for duplicate prevention
drop index if exists idx_product_categories_org_lower_name;
create unique index idx_product_categories_org_lower_name on product_categories (organization_id, lower(name));

-- RLS
alter table product_categories enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'product_categories_select') then
    create policy product_categories_select on product_categories
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'product_categories_insert') then
    create policy product_categories_insert on product_categories
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'product_categories_update') then
    create policy product_categories_update on product_categories
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'product_categories_delete') then
    create policy product_categories_delete on product_categories
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed default product categories for all existing organizations
insert into product_categories (organization_id, code, name, description, type, status, is_active)
select o.id, v.code, v.name, v.description, v.type, v.status, v.is_active
from organizations o
cross join (values
  ('MAR', 'Marchandises', 'Marchandises destinees a la revente', 'product', 'active', true),
  ('PF', 'Produits finis', 'Produits finis', 'product', 'active', true),
  ('MP', 'Matières premières', 'Matières premières', 'product', 'active', true),
  ('CON', 'Consommables', 'Consommables', 'product', 'active', true),
  ('PDR', 'Pièces détachées', 'Pièces détachées', 'product', 'active', true),
  ('FDB', 'Fournitures bureau', 'Fournitures de bureau', 'product', 'active', true),
  ('INF', 'Matériel informatique', 'Matériel informatique', 'product', 'active', true),
  ('EQP', 'Équipement', 'Équipement', 'product', 'active', true),
  ('SRV', 'Services', 'Prestations de services', 'service', 'active', true),
  ('PST', 'Prestations', 'Prestations diverses', 'service', 'active', true),
  ('MNT', 'Maintenance', 'Maintenance', 'service', 'active', true),
  ('TRP', 'Transport', 'Transport', 'service', 'active', true),
  ('LOC', 'Location', 'Location', 'service', 'active', true),
  ('ABO', 'Abonnement', 'Abonnement', 'service', 'active', true),
  ('AUT', 'Autre', 'Autre categorie', 'mixed', 'active', true)
) as v(code, name, description, type, status, is_active)
on conflict (organization_id, name) do nothing;

-- ============================================================
-- 2. units table
-- ============================================================
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  symbol text not null,
  description text,
  status text check (status in ('active', 'archived')) default 'active',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_by uuid references auth.users(id)
);

-- Unique constraint for upsert operations
alter table units drop constraint if exists units_org_symbol_key;
alter table units add constraint units_org_symbol_key unique (organization_id, symbol);

-- Case-insensitive unique index for duplicate prevention
drop index if exists idx_units_org_lower_symbol;
create unique index idx_units_org_lower_symbol on units (organization_id, lower(symbol));

-- RLS
alter table units enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'units_select') then
    create policy units_select on units
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'units_insert') then
    create policy units_insert on units
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'units_update') then
    create policy units_update on units
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'units_delete') then
    create policy units_delete on units
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed default units for all existing organizations
insert into units (organization_id, name, symbol, description, status, is_active)
select o.id, v.name, v.symbol, v.description, v.status, v.is_active
from organizations o
cross join (values
  ('Unité', 'U', 'Unité standard', 'active', true),
  ('Heure', 'h', 'Heure de travail', 'active', true),
  ('Jour', 'j', 'Jour', 'active', true),
  ('Mois', 'mois', 'Mois', 'active', true),
  ('Forfait', 'forfait', 'Forfait', 'active', true),
  ('Kilogramme', 'kg', 'Kilogramme', 'active', true),
  ('Gramme', 'g', 'Gramme', 'active', true),
  ('Litre', 'L', 'Litre', 'active', true),
  ('Mètre', 'm', 'Mètre', 'active', true),
  ('Mètre carré', 'm²', 'Mètre carré', 'active', true),
  ('Mètre cube', 'm³', 'Mètre cube', 'active', true),
  ('Boîte', 'boîte', 'Boîte', 'active', true),
  ('Carton', 'carton', 'Carton', 'active', true),
  ('Pack', 'pack', 'Pack', 'active', true),
  ('Lot', 'lot', 'Lot', 'active', true),
  ('Paire', 'paire', 'Paire', 'active', true),
  ('Pièce', 'pièce', 'Pièce', 'active', true)
) as v(name, symbol, description, status, is_active)
on conflict (organization_id, symbol) do nothing;

-- ============================================================
-- Reload schema cache
-- ============================================================
notify pgrst, 'reload schema';
