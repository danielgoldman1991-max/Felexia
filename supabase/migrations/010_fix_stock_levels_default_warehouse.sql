-- Felexia - ensure stock movements and levels always use a warehouse.
-- Idempotent corrective migration. No table is dropped and no data is deleted.

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.warehouses add column if not exists code text;
alter table public.warehouses add column if not exists status text;
alter table public.warehouses add column if not exists created_at timestamptz not null default now();
alter table public.warehouses add column if not exists updated_at timestamptz not null default now();

update public.warehouses
set code = 'MAIN'
where code is null;

update public.warehouses
set status = 'active'
where status is null;

insert into public.warehouses (organization_id, name, code, status)
select
  org.id,
  'Dépôt principal',
  'MAIN',
  'active'
from public.organizations org
where not exists (
  select 1
  from public.warehouses wh
  where wh.organization_id = org.id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warehouses_organization_code_unique'
      and conrelid = 'public.warehouses'::regclass
  ) then
    alter table public.warehouses
    add constraint warehouses_organization_code_unique
    unique (organization_id, code);
  end if;
exception
  when duplicate_table then null;
  when unique_violation then null;
end $$;

create table if not exists public.stock_levels (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.stock_levels add column if not exists warehouse_id uuid references public.warehouses(id) on delete cascade;
alter table public.stock_levels add column if not exists quantity numeric(14,3) not null default 0;
alter table public.stock_levels add column if not exists updated_at timestamptz not null default now();

with default_warehouses as (
  select distinct on (organization_id)
    organization_id,
    id
  from public.warehouses
  order by
    organization_id,
    case when name = 'Dépôt principal' then 0 else 1 end,
    created_at asc
)
update public.stock_levels sl
set warehouse_id = dw.id
from default_warehouses dw
where sl.organization_id = dw.organization_id
  and sl.warehouse_id is null;

alter table public.stock_levels alter column warehouse_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_levels_organization_warehouse_product_unique'
      and conrelid = 'public.stock_levels'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_levels'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) ilike '%organization_id%'
      and pg_get_constraintdef(oid) ilike '%warehouse_id%'
      and pg_get_constraintdef(oid) ilike '%product_id%'
  ) then
    alter table public.stock_levels
    add constraint stock_levels_organization_warehouse_product_unique
    unique (organization_id, warehouse_id, product_id);
  end if;
exception
  when duplicate_table then null;
  when unique_violation then null;
end $$;

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid references public.warehouses(id),
  product_id uuid not null references public.products(id),
  move_type text not null,
  direction text not null,
  quantity numeric(14,3) not null,
  source_document_id uuid,
  source_line_id uuid,
  movement_date timestamptz not null default now(),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.stock_moves add column if not exists warehouse_id uuid references public.warehouses(id);

with default_warehouses as (
  select distinct on (organization_id)
    organization_id,
    id
  from public.warehouses
  order by
    organization_id,
    case when name = 'Dépôt principal' then 0 else 1 end,
    created_at asc
)
update public.stock_moves sm
set warehouse_id = dw.id
from default_warehouses dw
where sm.organization_id = dw.organization_id
  and sm.warehouse_id is null;

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
  order by
    case when name = 'Dépôt principal' then 0 else 1 end,
    created_at asc
  limit 1;

  if warehouse_id is null then
    insert into public.warehouses (organization_id, name, code, status)
    values (target_organization_id, 'Dépôt principal', 'MAIN', 'active')
    returning id into warehouse_id;
  end if;

  return warehouse_id;
end;
$$;

create or replace function public.update_stock_level()
returns trigger
language plpgsql
as $$
declare
  target_warehouse_id uuid;
begin
  target_warehouse_id := coalesce(new.warehouse_id, public.get_default_warehouse_id(new.organization_id));

  insert into public.stock_levels (organization_id, warehouse_id, product_id, quantity)
  values (
    new.organization_id,
    target_warehouse_id,
    new.product_id,
    case
      when coalesce(new.direction, case when new.move_type::text in ('out', 'delivery_out', 'adjustment_out') then 'out' else 'in' end) = 'out'
      then -new.quantity
      else new.quantity
    end
  )
  on conflict (organization_id, warehouse_id, product_id)
  do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();

  return new;
end;
$$;

create index if not exists warehouses_organization_id_idx on public.warehouses (organization_id);
create index if not exists stock_levels_organization_id_idx on public.stock_levels (organization_id);
create index if not exists stock_levels_product_id_idx on public.stock_levels (product_id);
create index if not exists stock_levels_warehouse_id_idx on public.stock_levels (warehouse_id);
create index if not exists stock_moves_warehouse_id_idx on public.stock_moves (warehouse_id);
