-- Felexia - stock locations v1.
-- Keep the technical table name warehouses for compatibility, but enrich it as stock locations.

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.warehouses add column if not exists location_type text not null default 'warehouse';
alter table public.warehouses add column if not exists parent_id uuid null references public.warehouses(id) on delete set null;
alter table public.warehouses add column if not exists address text;
alter table public.warehouses add column if not exists city text;
alter table public.warehouses add column if not exists country text default 'MA';
alter table public.warehouses add column if not exists manager_name text;
alter table public.warehouses add column if not exists phone text;
alter table public.warehouses add column if not exists email text;
alter table public.warehouses add column if not exists notes text;
alter table public.warehouses add column if not exists is_default boolean not null default false;
alter table public.warehouses add column if not exists status text not null default 'active';
alter table public.warehouses add column if not exists created_by uuid null;
alter table public.warehouses add column if not exists archived_at timestamptz null;

update public.warehouses set location_type = 'warehouse' where location_type is null;
update public.warehouses set status = 'active' where status is null;
update public.warehouses set country = 'MA' where country is null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.warehouses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.warehouses drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'warehouses_location_type_check'
      and conrelid = 'public.warehouses'::regclass
  ) then
    alter table public.warehouses
      add constraint warehouses_location_type_check
      check (location_type in ('warehouse','depot','store','site','zone','rack','bin','vehicle','project','other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'warehouses_status_v1_check'
      and conrelid = 'public.warehouses'::regclass
  ) then
    alter table public.warehouses
      add constraint warehouses_status_v1_check
      check (status in ('active','inactive','archived'));
  end if;
end $$;

create index if not exists warehouses_organization_id_idx on public.warehouses (organization_id);
create index if not exists warehouses_code_idx on public.warehouses (code);
create index if not exists warehouses_location_type_idx on public.warehouses (location_type);
create index if not exists warehouses_parent_id_idx on public.warehouses (parent_id);
create index if not exists warehouses_status_idx on public.warehouses (status);
create index if not exists warehouses_archived_at_idx on public.warehouses (archived_at);
create index if not exists warehouses_is_default_idx on public.warehouses (is_default);

create unique index if not exists warehouses_organization_code_not_null_unique
  on public.warehouses (organization_id, code)
  where code is not null;

insert into public.warehouses (organization_id, name, code, location_type, is_default, status)
select org.id, 'Depot principal', 'DEPOT-PRINCIPAL', 'depot', true, 'active'
from public.organizations org
where not exists (
  select 1
  from public.warehouses wh
  where wh.organization_id = org.id
    and wh.status = 'active'
    and wh.archived_at is null
);

with first_active as (
  select distinct on (organization_id) id, organization_id
  from public.warehouses
  where status = 'active'
    and archived_at is null
  order by organization_id, is_default desc, created_at asc
)
update public.warehouses wh
set is_default = true
from first_active fa
where wh.id = fa.id
  and not exists (
    select 1
    from public.warehouses existing
    where existing.organization_id = fa.organization_id
      and existing.is_default = true
      and existing.status = 'active'
      and existing.archived_at is null
  );

create or replace function public.get_default_warehouse_id(target_organization_id uuid)
returns uuid
language plpgsql
as $$
declare
  warehouse_id uuid;
begin
  select id
  into warehouse_id
  from public.warehouses
  where organization_id = target_organization_id
    and status = 'active'
    and archived_at is null
  order by is_default desc, created_at asc
  limit 1;

  if warehouse_id is null then
    insert into public.warehouses (organization_id, name, code, location_type, is_default, status)
    values (target_organization_id, 'Depot principal', 'DEPOT-PRINCIPAL', 'depot', true, 'active')
    returning id into warehouse_id;
  end if;

  return warehouse_id;
end;
$$;
