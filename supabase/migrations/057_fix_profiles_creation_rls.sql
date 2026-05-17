create or replace function public.ensure_user_profile(
  p_full_name text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_full_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifie.';
  end if;

  select email into v_email
  from auth.users
  where id = v_user_id;

  v_email := coalesce(nullif(trim(p_email), ''), v_email);
  v_full_name := nullif(trim(p_full_name), '');

  insert into public.profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_email,
    v_full_name,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.ensure_user_profile(text, text) from public;
grant execute on function public.ensure_user_profile(text, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    concat_ws(
      ' ',
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(new.raw_user_meta_data ->> 'last_name', '')
    )
  )), '');

  insert into public.profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    v_full_name,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
