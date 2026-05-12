-- Migration 039: Subscription plans, billing, invitations
-- Adds stripe_customer_id to organizations, creates subscription/invitation tables

-- Add Stripe customer ID to organizations
alter table organizations add column if not exists stripe_customer_id text;

-- Create subscription plans table
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_monthly numeric(10,2) not null check (price_monthly >= 0),
  price_yearly numeric(10,2) not null check (price_yearly >= 0),
  stripe_price_monthly_id text,
  stripe_price_yearly_id text,
  features jsonb not null default '[]'::jsonb,
  max_members integer not null default 1 check (max_members >= 1),
  max_clients integer not null default -1 check (max_clients = -1 or max_clients >= 0),
  max_invoices integer not null default -1 check (max_invoices = -1 or max_invoices >= 0),
  includes_accounting boolean not null default false,
  includes_treasury boolean not null default false,
  includes_purchases boolean not null default false,
  includes_stock boolean not null default false,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create organization subscriptions table
create table if not exists organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null default 'incomplete' check (status in ('incomplete', 'active', 'past_due', 'canceled', 'unpaid', 'trialing')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stripe_subscription_id)
);

-- Create stripe events log table
create table if not exists stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  type text not null,
  data jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- Create invitations table
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role_id uuid references roles(id),
  invited_by uuid not null references profiles(id),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table subscription_plans enable row level security;
alter table organization_subscriptions enable row level security;
alter table stripe_events enable row level security;
alter table invitations enable row level security;

-- RLS policies for subscription_plans (all authenticated users can read public plans)
drop policy if exists subscription_plans_read_public on subscription_plans;
create policy subscription_plans_read_public on subscription_plans
  for select using (is_public = true);

-- RLS policies for organization_subscriptions (org members can read)
drop policy if exists organization_subscriptions_org_member_select on organization_subscriptions;
create policy organization_subscriptions_org_member_select on organization_subscriptions
  for select using (app_private.is_org_member(organization_id));

drop policy if exists organization_subscriptions_org_admin_insert on organization_subscriptions;
create policy organization_subscriptions_org_admin_insert on organization_subscriptions
  for insert with check (app_private.is_org_member(organization_id));

drop policy if exists organization_subscriptions_org_admin_update on organization_subscriptions;
create policy organization_subscriptions_org_admin_update on organization_subscriptions
  for update using (app_private.is_org_member(organization_id));

-- RLS policies for stripe_events (service role only - no direct user access)
drop policy if exists stripe_events_no_access on stripe_events;
create policy stripe_events_no_access on stripe_events
  for all using (false);

-- RLS policies for invitations (org members can manage)
drop policy if exists invitations_org_member_select on invitations;
create policy invitations_org_member_select on invitations
  for select using (app_private.is_org_member(organization_id));

drop policy if exists invitations_org_admin_insert on invitations;
create policy invitations_org_admin_insert on invitations
  for insert with check (app_private.is_org_member(organization_id));

drop policy if exists invitations_org_admin_update on invitations;
create policy invitations_org_admin_update on invitations
  for update using (app_private.is_org_member(organization_id));

-- Updated_at triggers
drop trigger if exists subscription_plans_set_updated_at on subscription_plans;
create trigger subscription_plans_set_updated_at before update on subscription_plans
  for each row execute function set_updated_at();

drop trigger if exists organization_subscriptions_set_updated_at on organization_subscriptions;
create trigger organization_subscriptions_set_updated_at before update on organization_subscriptions
  for each row execute function set_updated_at();

drop trigger if exists invitations_set_updated_at on invitations;
create trigger invitations_set_updated_at before update on invitations
  for each row execute function set_updated_at();

-- Indexes
create index if not exists organization_subscriptions_organization_id_idx on organization_subscriptions(organization_id);
create index if not exists organization_subscriptions_status_idx on organization_subscriptions(status);
create index if not exists invitations_organization_id_idx on invitations(organization_id);
create index if not exists invitations_email_idx on invitations(email);
create index if not exists invitations_token_idx on invitations(token);
create index if not exists stripe_events_type_idx on stripe_events(type);
create index if not exists stripe_events_stripe_event_id_idx on stripe_events(stripe_event_id);

-- Seed subscription plans
insert into subscription_plans (name, slug, description, price_monthly, price_yearly, features, max_members, max_clients, max_invoices, includes_accounting, includes_treasury, includes_purchases, includes_stock, sort_order) values
  ('Starter', 'starter', 'Pour les tres petites entreprises. Demarrez votre facturation en ligne.', 0, 0, '["Jusqu''a 3 clients", "Jusqu''a 10 factures/mois", "Facturation electronique", "Tableau de bord"]'::jsonb, 1, 3, 10, false, false, false, false, 1),
  ('Essentiel', 'essentiel', 'Pour les PME en croissance. Module comptable inclus.', 199, 1990, '["Clients illimites", "Factures Illimitees", "Module Comptable", "Gestion de tresorerie", "Devis et bons de livraison"]'::jsonb, 3, -1, -1, true, true, false, false, 2),
  ('Pro', 'pro', 'La solution complete. Achats, stock et fonctionnalites avancees.', 399, 3990, '["Tout l''Essentiel", "Module Achats", "Gestion de stock", "Reporting avance", "API et integrations", "Support prioritaire"]'::jsonb, 10, -1, -1, true, true, true, true, 3)
on conflict (slug) do nothing;
