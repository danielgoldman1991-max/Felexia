-- 1. Create customer_categories table
create table if not exists customer_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_categories add constraint customer_categories_org_name_key unique (organization_id, name);

alter table customer_categories enable row level security;

do $$
begin
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

-- 2. Add customer_category_id FK to third_parties
alter table third_parties add column if not exists customer_category_id uuid references customer_categories(id);

-- 3. Add code column to product_categories (nullable, e.g. "PF", "MP")
alter table product_categories add column if not exists code text;
alter table product_categories add constraint product_categories_org_code_key unique (organization_id, code);

-- 4. Add code column to tax_rates (nullable, e.g. "VAT_0", "VAT_EXEMPT")
alter table tax_rates add column if not exists code text;
alter table tax_rates add constraint tax_rates_org_code_key unique (organization_id, code);

-- 5. Seed defaults for ALL existing organizations (idempotent)
do $$
declare
  org record;
begin
  for org in select id from organizations loop
    -- Customer categories
    insert into customer_categories (organization_id, name, description, is_default)
    values
      (org.id, 'Client Comptoir', 'Client comptoir / vente directe', true),
      (org.id, 'Particulier', 'Client particulier', true),
      (org.id, 'Grand Compte', 'Grand compte / entreprise', true)
    on conflict (organization_id, name) do nothing;

    -- Item categories (product_categories) — no is_default column
    insert into product_categories (organization_id, code, name, description, type, status)
    values
      (org.id, 'PF', 'Produits finis', 'Produits finis', 'product', 'active'),
      (org.id, 'MP', 'Matières premières', 'Matières premières', 'product', 'active'),
      (org.id, 'PDR', 'Pièces de rechange', 'Pièces de rechange', 'product', 'active'),
      (org.id, 'CON', 'Consommables', 'Consommables', 'product', 'active'),
      (org.id, 'MOB', 'Mobilier', 'Mobilier', 'product', 'active'),
      (org.id, 'INF', 'Matériel informatique', 'Matériel informatique', 'product', 'active'),
      (org.id, 'FDB', 'Fourniture de bureau', 'Fourniture de bureau', 'product', 'active')
    on conflict (organization_id, name) do nothing;

    -- Units
    insert into units (organization_id, name, symbol, status)
    values
      (org.id, 'Unité', 'U', 'active'),
      (org.id, 'Pièce', 'PCS', 'active'),
      (org.id, 'Kilogramme', 'KG', 'active'),
      (org.id, 'Gramme', 'G', 'active'),
      (org.id, 'Litre', 'L', 'active'),
      (org.id, 'Mètre', 'M', 'active'),
      (org.id, 'Mètre carré', 'M2', 'active'),
      (org.id, 'Mètre cube', 'M3', 'active'),
      (org.id, 'Heure', 'H', 'active'),
      (org.id, 'Jour', 'J', 'active'),
      (org.id, 'Lot', 'LOT', 'active'),
      (org.id, 'Boîte', 'BOITE', 'active')
    on conflict (organization_id, symbol) do nothing;

    -- Tax rates
    insert into tax_rates (organization_id, name, rate, code, is_default, status, description)
    values
      (org.id, '0 %', 0, 'VAT_0', false, 'active', 'TVA 0 %'),
      (org.id, '7 %', 7, 'VAT_7', false, 'active', 'TVA 7 %'),
      (org.id, '10 %', 10, 'VAT_10', false, 'active', 'TVA 10 %'),
      (org.id, '14 %', 14, 'VAT_14', false, 'active', 'TVA 14 %'),
      (org.id, '20 %', 20, 'VAT_20', true, 'active', 'TVA 20 %'),
      (org.id, 'Exonéré', 0, 'VAT_EXEMPT', false, 'active', 'Exonéré de TVA')
    on conflict (organization_id, name) do nothing;
  end loop;
end $$;
