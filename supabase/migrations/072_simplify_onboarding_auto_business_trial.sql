alter table if exists public.organizations
  add column if not exists onboarding_step text default 'completed',
  add column if not exists onboarding_completed boolean not null default true,
  add column if not exists onboarding_completed_at timestamptz;

alter table if exists public.organizations
  alter column onboarding_step set default 'completed',
  alter column onboarding_completed set default true;

alter table if exists public.organization_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_consent_accepted boolean not null default true,
  add column if not exists trial_consent_accepted_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists plan_code text,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists organization_subscriptions_organization_id_unique
  on public.organization_subscriptions (organization_id);

update public.organizations o
set
  onboarding_step = 'completed',
  onboarding_completed = true,
  onboarding_completed_at = coalesce(o.onboarding_completed_at, now()),
  updated_at = now()
where o.onboarding_step in ('subscription_choice', 'getting_started')
  and exists (
    select 1
    from public.organization_subscriptions s
    where s.organization_id = o.id
      and s.status in ('trialing', 'active')
  );

insert into public.organization_subscriptions (
  organization_id,
  plan_id,
  plan_code,
  status,
  billing_cycle,
  billing_interval,
  trial_started_at,
  trial_start,
  trial_end,
  trial_ends_at,
  trial_consent_accepted,
  trial_consent_accepted_at,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  monthly_amount,
  yearly_amount,
  selected_modules,
  created_at,
  updated_at
)
select
  o.id,
  sp.id,
  'business',
  'trialing',
  'monthly',
  'monthly',
  now(),
  now(),
  now() + interval '14 days',
  now() + interval '14 days',
  true,
  now(),
  now(),
  now() + interval '14 days',
  false,
  690,
  6900,
  '["quotes","invoicing","documents","crm","purchases","stock","treasury","accounting"]'::jsonb,
  now(),
  now()
from public.organizations o
join public.subscription_plans sp on sp.code = 'business'
where not exists (
  select 1
  from public.organization_subscriptions os
  where os.organization_id = o.id
)
on conflict (organization_id) do nothing;

update public.organizations o
set
  onboarding_step = 'completed',
  onboarding_completed = true,
  onboarding_completed_at = coalesce(o.onboarding_completed_at, now()),
  updated_at = now()
where exists (
  select 1
  from public.organization_subscriptions s
  where s.organization_id = o.id
    and s.status in ('trialing', 'active')
);

insert into public.organization_modules (
  organization_id,
  module_key,
  enabled,
  created_at
)
select
  o.id,
  module_key,
  true,
  now()
from public.organizations o
cross join (
  values
    ('quotes'),
    ('invoicing'),
    ('documents'),
    ('crm'),
    ('purchases'),
    ('stock'),
    ('treasury'),
    ('accounting')
) as business_modules(module_key)
where exists (
  select 1
  from public.organization_subscriptions s
  where s.organization_id = o.id
    and s.plan_code = 'business'
    and s.status in ('trialing', 'active')
)
on conflict (organization_id, module_key) do update
set enabled = true;
