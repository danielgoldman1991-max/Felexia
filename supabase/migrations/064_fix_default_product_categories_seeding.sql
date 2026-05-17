-- Migration 064: Fix default product categories seeding
-- Ensures all needed columns exist on product_categories and units,
-- then seeds defaults for every organisation (ON CONFLICT prevents duplicates).

-- ============================================================
-- 1. product_categories — ensure all required columns exist
-- ============================================================
alter table product_categories add column if not exists code text;
alter table product_categories add column if not exists is_active boolean not null default true;

-- Seed defaults (idempotent: existing rows are skipped via ON CONFLICT)
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
-- 2. units — ensure all required columns exist
-- ============================================================
alter table units add column if not exists is_active boolean not null default true;

-- Seed defaults (idempotent: existing rows are skipped via ON CONFLICT)
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
-- 3. Reload schema cache
-- ============================================================
notify pgrst, 'reload schema';
