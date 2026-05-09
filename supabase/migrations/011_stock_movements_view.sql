-- Felexia - stock movement history and manual stock operations.
-- Idempotent additive migration. No table is dropped and no data is deleted.

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid references public.warehouses(id),
  product_id uuid not null references public.products(id),
  source_document_id uuid null references public.sales_documents(id) on delete set null,
  source_line_id uuid null references public.sales_document_lines(id) on delete set null,
  move_type text not null,
  direction text not null,
  quantity numeric(14,3) not null,
  movement_date timestamptz default now(),
  notes text null,
  created_by uuid null,
  created_at timestamptz default now()
);

alter table public.stock_moves add column if not exists warehouse_id uuid references public.warehouses(id);
alter table public.stock_moves add column if not exists source_document_id uuid;
alter table public.stock_moves add column if not exists source_line_id uuid;
alter table public.stock_moves add column if not exists direction text;
alter table public.stock_moves add column if not exists movement_date timestamptz default now();
alter table public.stock_moves add column if not exists notes text;
alter table public.stock_moves add column if not exists created_by uuid;
alter table public.stock_moves add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_moves'
      and column_name = 'move_type'
      and udt_name = 'stock_move_type'
  ) then
    alter table public.stock_moves
    alter column move_type type text
    using move_type::text;
  end if;
end $$;

update public.stock_moves
set direction = case
  when move_type in ('out', 'delivery_out', 'adjustment_out', 'manual_stock_out') then 'out'
  else 'in'
end
where direction is null;

update public.stock_moves
set move_type = 'adjustment_out'
where move_type = 'out';

update public.stock_moves
set move_type = 'adjustment_in'
where move_type in ('in', 'adjustment') or move_type is null;

update public.stock_moves set movement_date = now() where movement_date is null;
update public.stock_moves set created_at = now() where created_at is null;

alter table public.stock_moves alter column move_type set not null;
alter table public.stock_moves alter column direction set not null;
alter table public.stock_moves alter column quantity set not null;
alter table public.stock_moves alter column movement_date set default now();
alter table public.stock_moves alter column created_at set default now();

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.stock_moves'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%move_type%'
  loop
    execute format('alter table public.stock_moves drop constraint if exists %I', constraint_record.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_move_type_check'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves
    add constraint stock_moves_move_type_check
    check (move_type in (
      'delivery_out',
      'customer_return_in',
      'adjustment_in',
      'adjustment_out',
      'manual_stock_in',
      'manual_stock_out',
      'initial_stock',
      'purchase_in'
    ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_direction_check'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves
    add constraint stock_moves_direction_check
    check (direction in ('in', 'out'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_quantity_positive_check'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves
    add constraint stock_moves_quantity_positive_check
    check (quantity > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_source_document_id_fkey'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves
    add constraint stock_moves_source_document_id_fkey
    foreign key (source_document_id)
    references public.sales_documents(id)
    on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_source_line_id_fkey'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves
    add constraint stock_moves_source_line_id_fkey
    foreign key (source_line_id)
    references public.sales_document_lines(id)
    on delete set null;
  end if;
end $$;

create index if not exists stock_moves_organization_id_idx on public.stock_moves (organization_id);
create index if not exists stock_moves_product_id_idx on public.stock_moves (product_id);
create index if not exists stock_moves_movement_date_idx on public.stock_moves (movement_date);
create index if not exists stock_moves_move_type_idx on public.stock_moves (move_type);
create index if not exists stock_moves_direction_idx on public.stock_moves (direction);
create index if not exists stock_moves_warehouse_id_idx on public.stock_moves (warehouse_id);
create index if not exists stock_moves_source_document_id_idx on public.stock_moves (source_document_id);

grant select, insert on public.stock_moves to authenticated;
