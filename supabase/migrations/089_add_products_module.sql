-- Migration 089: Add the 'products' module to modules_catalog.
-- The Essentiel plan includes "Articles & Produits" (module key 'products'),
-- while the full Stock module (key 'stock') remains Business only.
-- Idempotent: uses ON CONFLICT DO UPDATE so re-running is safe.

insert into public.modules_catalog (module_key, name, description, monthly_price, yearly_price, is_active, sort_order)
values (
  'products',
  'Articles & Produits',
  'Produits, services, categories, unites et taux de TVA',
  0,
  0,
  true,
  18
)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;