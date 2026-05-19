alter table if exists public.organization_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_consent_accepted boolean not null default false,
  add column if not exists trial_consent_accepted_at timestamptz;

create index if not exists organization_subscriptions_trial_started_at_idx
  on public.organization_subscriptions (trial_started_at);

