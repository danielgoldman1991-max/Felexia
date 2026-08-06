-- 091_google_auth_profiles.sql
-- Authentification Google native (Supabase Auth Provider).
-- Ajoute les champs profil issus de Google + étend le RPC ensure_user_profile
-- et le trigger handle_new_user (fill-only-empty : aucun écrasement de
-- données modifiées manuellement).

-- 1. Colonnes profil
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text;

-- 2. RPC ensure_user_profile étendu (rétrocompatible : anciens appels 2 args OK)
create or replace function public.ensure_user_profile(
  p_full_name text default null,
  p_email text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifie.';
  end if;

  select email into v_email
  from auth.users
  where id = v_user_id;

  v_email := coalesce(nullif(trim(p_email), ''), v_email);

  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    avatar_url,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_email,
    nullif(trim(p_full_name), ''),
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    nullif(trim(p_avatar_url), ''),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.ensure_user_profile(text, text, text, text, text) from public;
grant execute on function public.ensure_user_profile(text, text, text, text, text) to authenticated;

-- 3. Trigger handle_new_user : capture aussi prénom / nom / avatar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_avatar_url text;
begin
  v_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    concat_ws(
      ' ',
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(new.raw_user_meta_data ->> 'last_name', '')
    )
  )), '');
  v_first_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'given_name'
  )), '');
  v_last_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'family_name'
  )), '');
  v_avatar_url := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  )), '');

  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    avatar_url,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    v_full_name,
    v_first_name,
    v_last_name,
    v_avatar_url,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
