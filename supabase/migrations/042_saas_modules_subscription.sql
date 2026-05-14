-- Migration 042: SaaS modules catalog + organization modules
-- Adds per-module pricing alongside existing plan-based subscriptions.
-- organization_modules tracks which modules are enabled per org.
-- modules_catalog defines available modules with their prices.

-- 1. Modules catalog
create table if not exists modules_catalog (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  name text not null,
  description text,
  monthly_price numeric(10,2) not null default 0 check (monthly_price >= 0),
  yearly_price numeric(10,2) not null default 0 check (yearly_price >= 0),
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Organization enabled modules
create table if not exists organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

-- 3. Extend organization_subscriptions with module billing fields
alter table organization_subscriptions add column if not exists trial_start timestamptz;
alter table organization_subscriptions add column if not exists trial_end timestamptz;
alter table organization_subscriptions add column if not exists monthly_amount numeric(10,2) default 0;
alter table organization_subscriptions add column if not exists yearly_amount numeric(10,2) default 0;
alter table organization_subscriptions add column if not exists selected_modules jsonb default '[]'::jsonb;
alter table organization_subscriptions add column if not exists stripe_checkout_session_id text;

-- 4. Enable RLS
alter table modules_catalog enable row level security;
alter table organization_modules enable row level security;

-- 5. RLS policies
drop policy if exists modules_catalog_read_all on modules_catalog;
create policy modules_catalog_read_all on modules_catalog
  for select to authenticated using (true);

drop policy if exists organization_modules_select on organization_modules;
create policy organization_modules_select on organization_modules
  for select to authenticated using (
    exists (select 1 from organization_members om where om.organization_id = organization_modules.organization_id and om.user_id = auth.uid() and om.status = 'active')
  );

drop policy if exists organization_modules_insert on organization_modules;
create policy organization_modules_insert on organization_modules
  for insert to authenticated with check (
    exists (select 1 from organization_members om join roles r on r.id = om.role_id where om.organization_id = organization_modules.organization_id and om.user_id = auth.uid() and om.status = 'active' and r.name in ('admin', 'owner'))
  );

drop policy if exists organization_modules_update on organization_modules;
create policy organization_modules_update on organization_modules
  for update to authenticated using (
    exists (select 1 from organization_members om join roles r on r.id = om.role_id where om.organization_id = organization_modules.organization_id and om.user_id = auth.uid() and om.status = 'active' and r.name in ('admin', 'owner'))
  );


