-- Migration 044: Seed modules_catalog with SaaS module definitions
-- Module keys match sidebar-data.ts moduleKey props and saas.ts guards.
-- Prices in MAD. Free modules (price=0) are always accessible without selection.
-- Idempotent: uses on conflict do nothing.

insert into modules_catalog (module_key, name, description, monthly_price, yearly_price, sort_order) values
  ('dashboard',  'Tableau de bord',                    'Vue d''ensemble de votre activité', 0, 0, 1),
  ('crm',        'CRM & Tiers',                        'Clients, prospects et activités commerciales', 49, 490, 2),
  ('quotes',     'Devis & Ventes',                     'Devis, commandes clients, bons de livraison', 49, 490, 3),
  ('invoicing',  'Facturation & Paiements',            'Factures, avoirs, paiements reçus et relances', 79, 790, 4),
  ('purchases',  'Achats',                             'Commandes fournisseurs, réceptions et factures fournisseur', 79, 790, 5),
  ('treasury',   'Trésorerie',                         'Comptes bancaires, caisses, rapprochement et prévisions', 49, 490, 6),
  ('accounting', 'Comptabilité',                       'Plan comptable, écritures, journaux, balance et TVA', 99, 990, 7),
  ('stock',      'Gestion de stock',                   'Produits, emplacements, mouvements et alertes', 69, 690, 8),
  ('documents',  'Gestion documentaire',               'Stockage et archivage de documents', 29, 290, 9),
  ('users',      'Utilisateurs & Habilitations',       'Gestion des utilisateurs, rôles et permissions', 0, 0, 10),
  ('settings',   'Paramètres & Configuration',         'Configuration de l''entreprise et préférences', 0, 0, 11)
on conflict (module_key) do nothing;
