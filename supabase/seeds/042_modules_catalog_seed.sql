-- Seed data: SaaS modules catalog
-- Each module has a stable module_key used for access control throughout the app.
-- Prices are in MAD. Set to 0 for modules included in all plans.
-- Stripe price IDs should be set once Stripe products/prices are created.

insert into modules_catalog (module_key, name, description, monthly_price, yearly_price, sort_order) values
  ('dashboard',       'Tableau de bord',            'Vue d''ensemble de votre activité', 0, 0, 1),
  ('crm',             'Clients & CRM',               'Gestion des clients, prospects et tiers', 49, 490, 2),
  ('quotes',          'Devis',                       'Création et suivi des devis', 49, 490, 3),
  ('invoicing',       'Facturation',                 'Factures, avoirs et paiements clients', 79, 790, 4),
  ('purchases',       'Achats',                      'Commandes fournisseurs, réceptions, factures fournisseur', 79, 790, 5),
  ('treasury',        'Trésorerie',                  'Comptes bancaires, caisses, rapprochement', 49, 490, 6),
  ('accounting',      'Comptabilité',                'Plan comptable, écritures, journaux, TVA', 99, 990, 7),
  ('stock',           'Stocks',                      'Gestion des stocks, emplacements, mouvements', 69, 690, 8),
  ('documents',       'Documents',                   'Gestion documentaire et archives', 29, 290, 9),
  ('users',           'Utilisateurs & habilitations', 'Gestion des utilisateurs et droits d''accès', 0, 0, 10),
  ('settings',        'Paramètres',                  'Configuration de l''entreprise', 0, 0, 11)
on conflict (module_key) do nothing;
