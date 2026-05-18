-- Replace module-based billing with three fixed subscription packs.
-- This migration is additive/idempotent: it preserves existing data and old columns
-- while making plan_code the durable subscription truth for Felexia.

alter table if exists public.subscription_plans
  add column if not exists code text,
  add column if not exists monthly_price numeric,
  add column if not exists yearly_price numeric,
  add column if not exists currency text default 'MAD',
  add column if not exists max_users integer,
  add column if not exists max_documents_per_month integer,
  add column if not exists storage_limit_mb integer,
  add column if not exists is_recommended boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz default now();

update public.subscription_plans
set
  code = coalesce(code, slug),
  monthly_price = coalesce(monthly_price, price_monthly),
  yearly_price = coalesce(yearly_price, price_yearly),
  max_users = coalesce(max_users, max_members),
  currency = coalesce(currency, 'MAD')
where code is null
   or monthly_price is null
   or yearly_price is null
   or max_users is null
   or currency is null;

alter table if exists public.subscription_plans
  alter column code set not null;

create unique index if not exists subscription_plans_code_key
  on public.subscription_plans (code);

insert into public.subscription_plans (
  code,
  slug,
  name,
  description,
  monthly_price,
  yearly_price,
  price_monthly,
  price_yearly,
  currency,
  max_users,
  max_members,
  max_documents_per_month,
  storage_limit_mb,
  features,
  is_recommended,
  is_active,
  sort_order
)
values
  (
    'essentiel',
    'essentiel',
    'Essentiel',
    'Gestion commerciale simple pour demarrer proprement.',
    290,
    2900,
    290,
    2900,
    'MAD',
    3,
    3,
    500,
    1024,
    '["dashboard","clients","products","quotes","orders","invoices","payments","documents","import_export","company_settings","users_basic"]'::jsonb,
    false,
    true,
    1
  ),
  (
    'business',
    'business',
    'Business',
    'Pack recommande pour ventes, achats, stock et preparation comptable.',
    690,
    6900,
    690,
    6900,
    'MAD',
    10,
    10,
    3000,
    5120,
    '["dashboard","clients","products","quotes","orders","invoices","payments","documents","import_export","leads","pipeline","delivery_notes","purchases","suppliers","stock","accounting_basic","vat","roles_permissions","audit_log"]'::jsonb,
    true,
    true,
    2
  ),
  (
    'premium',
    'premium',
    'Premium',
    'Pack avance pour comptabilite, reporting, exports et support prioritaire.',
    1290,
    12900,
    1290,
    12900,
    'MAD',
    25,
    25,
    null,
    20480,
    '["dashboard","clients","products","quotes","orders","invoices","payments","documents","import_export","leads","pipeline","delivery_notes","purchases","suppliers","stock","accounting_basic","accounting_advanced","vat","vat_advanced","reports_advanced","advanced_permissions","priority_support"]'::jsonb,
    false,
    true,
    3
  )
on conflict (code) do update
set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  currency = excluded.currency,
  max_users = excluded.max_users,
  max_members = excluded.max_members,
  max_documents_per_month = excluded.max_documents_per_month,
  storage_limit_mb = excluded.storage_limit_mb,
  features = excluded.features,
  is_recommended = excluded.is_recommended,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table if exists public.organization_subscriptions
  add column if not exists plan_code text,
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz default now();

update public.organization_subscriptions os
set plan_code = coalesce(os.plan_code, sp.code, sp.slug, 'business')
from public.subscription_plans sp
where os.plan_id = sp.id
  and os.plan_code is null;

update public.organization_subscriptions
set
  plan_code = coalesce(plan_code, 'business'),
  billing_cycle = coalesce(billing_cycle, billing_interval, 'monthly'),
  trial_ends_at = coalesce(trial_ends_at, trial_end)
where plan_code is null
   or billing_cycle is null
   or trial_ends_at is null;

create unique index if not exists organization_subscriptions_org_id_key
  on public.organization_subscriptions (organization_id);

create index if not exists organization_subscriptions_plan_code_idx
  on public.organization_subscriptions (plan_code);

create index if not exists organization_subscriptions_status_idx
  on public.organization_subscriptions (status);

insert into public.organization_subscriptions (
  organization_id,
  plan_id,
  plan_code,
  status,
  billing_cycle,
  billing_interval,
  trial_start,
  trial_end,
  trial_ends_at,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  monthly_amount,
  yearly_amount,
  selected_modules
)
select
  o.id,
  sp.id,
  'business',
  'trialing',
  'monthly',
  'monthly',
  now(),
  now() + interval '14 days',
  now() + interval '14 days',
  now(),
  now() + interval '14 days',
  false,
  690,
  6900,
  '["quotes","invoicing","documents","crm","purchases","stock","treasury","accounting"]'::jsonb
from public.organizations o
cross join public.subscription_plans sp
where sp.code = 'business'
  and not exists (
    select 1
    from public.organization_subscriptions os
    where os.organization_id = o.id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_subscriptions_plan_code_fkey'
  ) then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_plan_code_fkey
      foreign key (plan_code)
      references public.subscription_plans(code);
  end if;
exception
  when duplicate_object then null;
end $$;
