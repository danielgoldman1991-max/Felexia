-- Migration 040: Settings module - document_settings, user_preferences, permissions

-- Document settings table
create table if not exists public.document_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_color text default '#111827',
  logo_url text,
  invoice_terms text,
  legal_mentions text,
  footer_note text,
  quote_prefix text default 'DEV',
  invoice_prefix text default 'FAC',
  credit_note_prefix text default 'AV',
  delivery_note_prefix text default 'BL',
  payment_prefix text default 'REG',
  numbering_format text default '{PREFIX}-{YEAR}-{NUMBER}',
  next_quote_number integer default 1,
  next_invoice_number integer default 1,
  next_credit_note_number integer default 1,
  next_delivery_note_number integer default 1,
  show_ice boolean default true,
  show_rc boolean default true,
  show_stamp_signature boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

-- User preferences table
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  language text default 'fr',
  currency text default 'MAD',
  date_format text default 'DD/MM/YYYY',
  timezone text default 'Africa/Casablanca',
  theme text default 'system',
  rows_per_page integer default 20,
  compact_mode boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- Add missing columns to company_settings
alter table public.company_settings add column if not exists phone text;
alter table public.company_settings add column if not exists email text;
alter table public.company_settings add column if not exists website text;
alter table public.company_settings add column if not exists logo_url text;
alter table public.company_settings add column if not exists activity text;
alter table public.company_settings add column if not exists tax_identifier text;

-- Add missing columns to organizations
alter table public.organizations add column if not exists legal_name text;
alter table public.organizations add column if not exists commercial_name text;
alter table public.organizations add column if not exists ice text;
alter table public.organizations add column if not exists rc text;
alter table public.organizations add column if not exists if_number text;
alter table public.organizations add column if not exists cnss text;
alter table public.organizations add column if not exists tax_identifier text;
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists city text;
alter table public.organizations add column if not exists country text default 'MA';
alter table public.organizations add column if not exists phone text;
alter table public.organizations add column if not exists email text;
alter table public.organizations add column if not exists website text;
alter table public.organizations add column if not exists logo_url text;
alter table public.organizations add column if not exists activity text;
alter table public.organizations add column if not exists currency text default 'MAD';

-- Enable RLS
alter table public.document_settings enable row level security;
alter table public.user_preferences enable row level security;

-- RLS policies
drop policy if exists document_settings_org_member_select on document_settings;
create policy document_settings_org_member_select on document_settings
  for select using (app_private.is_org_member(organization_id));

drop policy if exists document_settings_org_admin_insert on document_settings;
create policy document_settings_org_admin_insert on document_settings
  for insert with check (app_private.is_org_member(organization_id));

drop policy if exists document_settings_org_admin_update on document_settings;
create policy document_settings_org_admin_update on document_settings
  for update using (app_private.is_org_member(organization_id));

drop policy if exists user_preferences_self on user_preferences;
create policy user_preferences_self on user_preferences
  for all using (user_id = auth.uid());

-- Updated_at triggers
drop trigger if exists document_settings_set_updated_at on document_settings;
create trigger document_settings_set_updated_at before update on document_settings
  for each row execute function set_updated_at();

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at before update on user_preferences
  for each row execute function set_updated_at();

-- Indexes
create index if not exists document_settings_organization_id_idx on document_settings(organization_id);
create index if not exists user_preferences_user_id_idx on user_preferences(user_id);
create index if not exists user_preferences_organization_id_idx on user_preferences(organization_id);

-- Seed extended permissions
insert into permissions (code, description) values
  ('dashboard.read', 'Consulter le tableau de bord'),
  ('clients.read', 'Consulter les clients'),
  ('clients.create', 'Creer des clients'),
  ('clients.update', 'Modifier des clients'),
  ('clients.delete', 'Supprimer des clients'),
  ('suppliers.read', 'Consulter les fournisseurs'),
  ('suppliers.create', 'Creer des fournisseurs'),
  ('suppliers.update', 'Modifier des fournisseurs'),
  ('suppliers.delete', 'Supprimer des fournisseurs'),
  ('items.read', 'Consulter les articles'),
  ('items.create', 'Creer des articles'),
  ('items.update', 'Modifier des articles'),
  ('items.delete', 'Supprimer des articles'),
  ('sales.read', 'Consulter les ventes'),
  ('sales.create_quote', 'Creer des devis'),
  ('sales.validate_quote', 'Valider des devis'),
  ('sales.create_invoice', 'Creer des factures'),
  ('sales.validate_invoice', 'Valider des factures'),
  ('sales.cancel_invoice', 'Annuler des factures'),
  ('sales.delete', 'Supprimer des ventes'),
  ('purchases.read', 'Consulter les achats'),
  ('purchases.create', 'Creer des achats'),
  ('purchases.validate', 'Valider des achats'),
  ('purchases.cancel', 'Annuler des achats'),
  ('purchases.delete', 'Supprimer des achats'),
  ('stock.read', 'Consulter le stock'),
  ('stock.adjust', 'Ajuster le stock'),
  ('stock.transfer', 'Transferer le stock'),
  ('stock.inventory', 'Gerer les inventaires'),
  ('treasury.read', 'Consulter la tresorerie'),
  ('treasury.create_payment', 'Creer des paiements'),
  ('treasury.validate_payment', 'Valider des paiements'),
  ('treasury.reconcile', 'Rapprocher des ecritures'),
  ('treasury.delete', 'Supprimer des paiements'),
  ('accounting.read', 'Consulter la comptabilite'),
  ('accounting.post_entries', 'Saisir des ecritures'),
  ('accounting.edit_entries', 'Modifier des ecritures'),
  ('accounting.edit_chart_accounts', 'Modifier le plan comptable'),
  ('accounting.close_period', 'Cloturer une periode'),
  ('reports.read', 'Consulter les rapports'),
  ('reports.export', 'Exporter les rapports'),
  ('users.read', 'Consulter les utilisateurs'),
  ('users.invite', 'Inviter des utilisateurs'),
  ('users.update_roles', 'Modifier les roles'),
  ('users.disable', 'Desactiver des utilisateurs'),
  ('users.remove', 'Supprimer des utilisateurs'),
  ('settings.read', 'Consulter les parametres'),
  ('settings.company_update', 'Modifier les informations entreprise'),
  ('settings.documents_update', 'Modifier les parametres documents'),
  ('settings.security_update', 'Modifier les parametres securite'),
  ('billing.read', 'Consulter la facturation'),
  ('billing.manage', 'Gerer l''abonnement')
on conflict (code) do nothing;
