create table if not exists public.company_lookup_cache (
  query_hash text primary key,
  normalized_query text not null,
  query_type text not null check (query_type in ('ice', 'raison_sociale')),
  source text not null default 'configured_api',
  results jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_lookup_rate_limits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.company_lookup_cache enable row level security;
alter table public.company_lookup_rate_limits enable row level security;

drop policy if exists company_lookup_cache_authenticated_select on public.company_lookup_cache;
create policy company_lookup_cache_authenticated_select
on public.company_lookup_cache
for select
to authenticated
using (true);

drop policy if exists company_lookup_cache_authenticated_insert on public.company_lookup_cache;
create policy company_lookup_cache_authenticated_insert
on public.company_lookup_cache
for insert
to authenticated
with check (true);

drop policy if exists company_lookup_cache_authenticated_update on public.company_lookup_cache;
create policy company_lookup_cache_authenticated_update
on public.company_lookup_cache
for update
to authenticated
using (true)
with check (true);

drop policy if exists company_lookup_rate_select_own on public.company_lookup_rate_limits;
create policy company_lookup_rate_select_own
on public.company_lookup_rate_limits
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists company_lookup_rate_insert_own on public.company_lookup_rate_limits;
create policy company_lookup_rate_insert_own
on public.company_lookup_rate_limits
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists company_lookup_rate_update_own on public.company_lookup_rate_limits;
create policy company_lookup_rate_update_own
on public.company_lookup_rate_limits
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists company_lookup_cache_expires_at_idx
  on public.company_lookup_cache (expires_at);

create index if not exists company_lookup_rate_limits_user_window_idx
  on public.company_lookup_rate_limits (user_id, window_start);

notify pgrst, 'reload schema';
