-- 092_profiles_own_rls.sql
-- Garantit les politiques RLS d'un utilisateur sur son propre profil
-- (id = auth.uid()) pour le flux OAuth Google : lecture (callback,
-- onboarding), insertion (fallback de ensure_user_profile), mise à jour
-- (fill-only-empty, createEntrepriseAction).
-- Idempotent : CREATE POLICY ne supporte PAS "if not exists" (42601) —
-- chaque politique est créée seulement si absente (pg_policy), et aucune
-- politique existante n'est supprimée.

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and p.polname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and p.polname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and p.polname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
  end if;
end $$;
