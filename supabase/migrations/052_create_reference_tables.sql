-- Migration 052: Create reference tables for categories, units, and tax rates

-- ============================================================
-- 1. customer_categories
-- ============================================================
create table if not exists customer_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint for ON CONFLICT support
alter table customer_categories drop constraint if exists customer_categories_org_name_key;
alter table customer_categories drop constraint if exists customer_categories_organization_id_name_key;
alter table customer_categories add constraint customer_categories_org_name_key unique (organization_id, name);

-- Case-insensitive unique index for duplicate prevention
drop index if exists idx_customer_categories_org_lower_name;
create unique index idx_customer_categories_org_lower_name on customer_categories (organization_id, lower(name));

-- RLS
alter table customer_categories enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'customer_categories_select') then
    create policy customer_categories_select on customer_categories
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'customer_categories_insert') then
    create policy customer_categories_insert on customer_categories
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'customer_categories_update') then
    create policy customer_categories_update on customer_categories
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'customer_categories_delete') then
    create policy customer_categories_delete on customer_categories
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed defaults for all existing organizations
insert into customer_categories (organization_id, name, description, is_default)
select o.id, v.name, v.description, v.is_default
from organizations o
cross join (values
  ('Client Comptoir', 'Client comptoir / vente directe', true),
  ('Particulier', 'Client particulier', true),
  ('Grand Compte', 'Grand compte / entreprise', true)
) as v(name, description, is_default)
on conflict (organization_id, name) do nothing;

-- Add FK from third_parties to customer_categories
alter table third_parties add column if not exists customer_category_id uuid references customer_categories(id);

-- ============================================================
-- 2. item_categories
-- ============================================================
create table if not exists item_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table item_categories add column if not exists code text;
alter table item_categories add constraint item_categories_org_code_key unique (organization_id, code);

-- RLS
alter table item_categories enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'item_categories_select') then
    create policy item_categories_select on item_categories
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_categories_insert') then
    create policy item_categories_insert on item_categories
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_categories_update') then
    create policy item_categories_update on item_categories
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_categories_delete') then
    create policy item_categories_delete on item_categories
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed defaults for all existing organizations
insert into item_categories (organization_id, code, name, description, is_default)
select o.id, v.code, v.name, v.description, v.is_default
from organizations o
cross join (values
  ('PF', 'Produits finis', 'Produits finis', false),
  ('MP', 'Matières premières', 'Matières premières', false),
  ('PDR', 'Pièces de rechange', 'Pièces de rechange', false),
  ('CON', 'Consommables', 'Consommables', false),
  ('MOB', 'Mobilier', 'Mobilier', false),
  ('INF', 'Matériel informatique', 'Matériel informatique', false),
  ('FDB', 'Fourniture de bureau', 'Fourniture de bureau', false)
) as v(code, name, description, is_default)
on conflict (organization_id, code) do nothing;

-- ============================================================
-- 3. item_units
-- ============================================================
create table if not exists item_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table item_units add column if not exists code text;
alter table item_units add constraint item_units_org_code_key unique (organization_id, code);

-- RLS
alter table item_units enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'item_units_select') then
    create policy item_units_select on item_units
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_units_insert') then
    create policy item_units_insert on item_units
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_units_update') then
    create policy item_units_update on item_units
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'item_units_delete') then
    create policy item_units_delete on item_units
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed defaults for all existing organizations
insert into item_units (organization_id, code, name, is_default)
select o.id, v.code, v.name, v.is_default
from organizations o
cross join (values
  ('U', 'Unité', false),
  ('PCS', 'Pièce', false),
  ('KG', 'Kilogramme', false),
  ('G', 'Gramme', false),
  ('L', 'Litre', false),
  ('M', 'Mètre', false),
  ('M2', 'Mètre carré', false),
  ('M3', 'Mètre cube', false),
  ('H', 'Heure', false),
  ('J', 'Jour', false),
  ('LOT', 'Lot', false),
  ('BOITE', 'Boîte', false)
) as v(code, name, is_default)
on conflict (organization_id, code) do nothing;

-- ============================================================
-- 4. tax_rates
-- ============================================================
-- Handle both fresh DB (table doesn't exist) and existing DB (table with name column)
do $$ begin
  if not exists (select 1 from information_schema.tables where table_name = 'tax_rates' and table_schema = 'public') then
    create table tax_rates (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id) on delete cascade,
      label text not null,
      rate numeric,
      code text not null,
      is_default boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    -- Add backward-compat columns (same as old tax_rates)
    alter table tax_rates add column name text;
    alter table tax_rates add column status text check (status in ('active', 'archived'));
    alter table tax_rates add column description text;
  else
    -- Existing table: add missing columns
    alter table tax_rates add column if not exists label text;
    alter table tax_rates add column if not exists is_active boolean not null default true;
    alter table tax_rates add column if not exists code text;
    alter table tax_rates alter column name drop not null;
    update tax_rates set label = name where label is null and name is not null;
  end if;
end $$;

-- Ensure code column exists before constraint
alter table tax_rates add column if not exists code text;

-- Drop old constraints, replace with unique (organization_id, code)
alter table tax_rates drop constraint if exists tax_rates_organization_id_name_key;
alter table tax_rates drop constraint if exists tax_rates_org_name_key;
alter table tax_rates drop constraint if exists tax_rates_org_code_key;
alter table tax_rates add constraint tax_rates_org_code_key unique (organization_id, code);

-- RLS (idempotent)
alter table tax_rates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_select') then
    create policy tax_rates_select on tax_rates
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_insert') then
    create policy tax_rates_insert on tax_rates
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_update') then
    create policy tax_rates_update on tax_rates
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_delete') then
    create policy tax_rates_delete on tax_rates
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

-- Seed defaults for all existing organizations
insert into tax_rates (organization_id, label, rate, code, is_default, is_active)
select o.id, v.label, v.rate, v.code, v.is_default, v.is_active
from organizations o
cross join (values
  ('0 %', 0, 'VAT_0', false, true),
  ('7 %', 7, 'VAT_7', false, true),
  ('10 %', 10, 'VAT_10', false, true),
  ('14 %', 14, 'VAT_14', false, true),
  ('20 %', 20, 'VAT_20', true, true),
  ('Exonéré', 0, 'VAT_EXEMPT', false, true)
) as v(label, rate, code, is_default, is_active)
on conflict (organization_id, code) do nothing;

-- ============================================================
-- Reload schema cache
-- ============================================================
notify pgrst, 'reload schema';
