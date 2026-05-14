-- Migration 046: Seed modules_catalog with all SaaS modules
-- Covers sidebar-data.ts moduleKey props, guard layouts, and user-facing catalog.
-- Idempotent: uses ON CONFLICT DO UPDATE so re-running is safe.

-- Ensure RLS policy exists so authenticated users can read the catalog
alter table modules_catalog enable row level security;
drop policy if exists modules_catalog_read_all on modules_catalog;
create policy modules_catalog_read_all on modules_catalog
  for select to authenticated using (true);

insert into modules_catalog (module_key, name, description, monthly_price, yearly_price, is_active, sort_order) values
  ('dashboard',  'Tableau de bord',                    'Vue d''ensemble de votre activité en temps réel', 0, 0, true, 1),
  ('sales',      'Ventes',                             'Gestion des ventes, commandes clients et chiffre d''affaires', 49, 490, true, 2),
  ('crm',        'CRM & Tiers',                        'Clients, prospects, fournisseurs et activités commerciales', 49, 490, true, 3),
  ('quotes',     'Devis',                              'Création, envoi et suivi des devis clients', 49, 490, true, 4),
  ('invoicing',  'Facturation & Paiements',             'Factures, avoirs, paiements reçus et relances', 79, 790, true, 5),
  ('invoices',   'Factures',                           'Gestion dédiée des factures clients et fournisseurs', 79, 790, true, 6),
  ('purchases',  'Achats',                             'Commandes fournisseurs, réceptions et factures fournisseur', 79, 790, true, 7),
  ('suppliers',  'Fournisseurs',                       'Gestion des fournisseurs et achats', 49, 490, true, 8),
  ('stock',      'Gestion de stock',                   'Produits, emplacements, mouvements et alertes stock', 69, 690, true, 9),
  ('treasury',   'Trésorerie',                         'Comptes bancaires, caisses, rapprochement et prévisions', 49, 490, true, 10),
  ('recovery',   'Recouvrement',                       'Relances clients, impayés et suivi des créances', 39, 390, true, 11),
  ('accounting', 'Comptabilité',                       'Plan comptable, écritures, journaux, balance et TVA', 99, 990, true, 12),
  ('reporting',  'Rapports & Analyse',                 'Tableaux de bord, rapports financiers et export', 49, 490, true, 13),
  ('users',      'Utilisateurs & Habilitations',       'Gestion des utilisateurs, rôles et permissions', 0, 0, true, 14),
  ('documents',  'Gestion documentaire',               'Stockage, archivage et versioning de documents', 29, 290, true, 15),
  ('settings',   'Paramètres & Configuration',         'Configuration de l''entreprise et préférences', 0, 0, true, 16)
on conflict (module_key) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
