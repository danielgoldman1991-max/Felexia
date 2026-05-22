-- Migration: add missing rh module to modules_catalog
-- Fixes FK violation when upserting organization_modules for Business trial.

insert into public.modules_catalog (module_key, name, description, monthly_price, yearly_price, is_active, sort_order)
values
  ('rh', 'Ressources Humaines', 'Gestion des employes, contrats, conges et paie', 49, 490, true, 17)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
