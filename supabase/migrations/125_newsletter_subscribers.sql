-- 125: public newsletter subscribers and gated product-guide downloads.
-- Apply after 124. Additive. Raw IP addresses and remember-tokens are not stored.
-- Inserts go through the Next.js server using the service role. anon and authenticated have no access.
-- Rollback: supabase/rollbacks/125_newsletter_subscribers_rollback.sql
-- Export after apply: npx tsx scripts/export-newsletter-subscribers.ts

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text null,
  company text null,
  phone text null,
  sector text null,
  source text not null,
  consent boolean not null default false,
  consent_at timestamptz null,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz null,
  unsubscribe_token uuid not null default gen_random_uuid(),
  constraint newsletter_subscribers_email_unique unique (email),
  constraint newsletter_subscribers_unsubscribe_token_unique unique (unsubscribe_token),
  constraint newsletter_subscribers_email_shape check (
    char_length(email) between 6 and 254
    and email = lower(email)
    and position('@' in email) > 1
  ),
  constraint newsletter_subscribers_source_check check (
    source ~ '^(footer|popup|blog|guides|guide:[a-z0-9]+(-[a-z0-9]+)*)$'
  ),
  constraint newsletter_subscribers_consent_check check (
    (consent = true and consent_at is not null) or (consent = false and consent_at is null)
  ),
  constraint newsletter_subscribers_first_name_len check (first_name is null or char_length(first_name) between 1 and 80),
  constraint newsletter_subscribers_company_len check (company is null or char_length(company) between 1 and 120),
  constraint newsletter_subscribers_phone_len check (phone is null or char_length(phone) between 1 and 30),
  constraint newsletter_subscribers_sector_len check (sector is null or char_length(sector) between 1 and 80),
  constraint newsletter_subscribers_ip_hash_len check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_subscribers_user_agent_len check (user_agent is null or char_length(user_agent) between 1 and 300)
);

create table if not exists public.guide_downloads (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  guide_slug text not null,
  created_at timestamptz not null default now(),
  constraint guide_downloads_slug_check check (guide_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists guide_downloads_subscriber_idx on public.guide_downloads (subscriber_id, created_at desc);
create index if not exists guide_downloads_slug_idx on public.guide_downloads (guide_slug, created_at desc);

create table if not exists public.guide_access_grants (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  guide_slug text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz null,
  constraint guide_access_grants_token_unique unique (token_hash),
  constraint guide_access_grants_slug_check check (guide_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint guide_access_grants_token_hash_len check (token_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.newsletter_subscribers is
  'Marketing contacts. consent is the newsletter opt-in (loi 09-08), distinct from a guide download.';
comment on table public.guide_downloads is
  'One row each time a short-lived guide download link is issued.';
comment on table public.guide_access_grants is
  'SHA-256 of the browser remember-token. The raw token is never stored.';

alter table public.newsletter_subscribers enable row level security;
alter table public.guide_downloads enable row level security;
alter table public.guide_access_grants enable row level security;

revoke all on table public.newsletter_subscribers from public, anon, authenticated;
revoke all on table public.guide_downloads from public, anon, authenticated;
revoke all on table public.guide_access_grants from public, anon, authenticated;
