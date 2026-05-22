alter table public.company_lookup_cache
  add column if not exists ice text null;

alter table public.company_lookup_cache
  add column if not exists raison_sociale text null;

alter table public.company_lookup_cache
  add column if not exists rc text null;

alter table public.company_lookup_cache
  add column if not exists if_number text null;

alter table public.company_lookup_cache
  add column if not exists adresse text null;

alter table public.company_lookup_cache
  add column if not exists ville text null;

alter table public.company_lookup_cache
  add column if not exists status text null;

alter table public.company_lookup_cache
  add column if not exists error_message text null;

alter table public.company_lookup_cache
  add column if not exists confidence_score integer not null default 0;

alter table public.company_lookup_cache
  add column if not exists raw_data jsonb null;

alter table public.company_lookup_cache
  add column if not exists last_checked_at timestamptz not null default now();

create unique index if not exists company_lookup_cache_ice_unique
  on public.company_lookup_cache (ice)
  where ice is not null;

notify pgrst, 'reload schema';
