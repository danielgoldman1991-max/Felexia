-- Felexia - Delivery notes, customer returns and stock movements.
-- Additive migration for Sales V1. No table is dropped and no data is deleted.

alter table public.sales_documents add column if not exists related_order_id uuid null references public.sales_documents(id);
alter table public.sales_documents add column if not exists related_delivery_id uuid null references public.sales_documents(id);
alter table public.sales_documents add column if not exists return_reason text null;
alter table public.sales_documents add column if not exists return_status text null;
alter table public.sales_documents add column if not exists stock_updated_at timestamptz null;
alter table public.sales_documents add column if not exists validated_at timestamptz null;
alter table public.sales_documents add column if not exists delivered_at timestamptz null;
alter table public.sales_documents add column if not exists returned_at timestamptz null;

alter table public.sales_document_lines add column if not exists source_line_id uuid null references public.sales_document_lines(id);
alter table public.sales_document_lines add column if not exists ordered_quantity numeric(14,3) null;
alter table public.sales_document_lines add column if not exists delivered_quantity numeric(14,3) not null default 0;
alter table public.sales_document_lines add column if not exists returned_quantity numeric(14,3) not null default 0;
alter table public.sales_document_lines add column if not exists remaining_quantity numeric(14,3) null;
alter table public.sales_document_lines add column if not exists stock_move_id uuid null;

alter table public.products add column if not exists current_stock numeric(14,3) not null default 0;
alter table public.products add column if not exists track_stock boolean not null default false;

do $$
begin
  alter type public.stock_move_type add value if not exists 'delivery_out';
  alter type public.stock_move_type add value if not exists 'customer_return_in';
  alter type public.stock_move_type add value if not exists 'adjustment_in';
  alter type public.stock_move_type add value if not exists 'adjustment_out';
exception
  when undefined_object then null;
end $$;

alter table public.stock_moves alter column warehouse_id drop not null;
alter table public.stock_moves add column if not exists source_line_id uuid null references public.sales_document_lines(id);
alter table public.stock_moves add column if not exists direction text null check (direction in ('in', 'out'));
alter table public.stock_moves add column if not exists movement_date timestamptz not null default now();
alter table public.stock_moves add column if not exists notes text null;

update public.stock_moves
set direction = case when move_type::text in ('out', 'delivery_out', 'adjustment_out') then 'out' else 'in' end
where direction is null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.sales_documents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%document_type%'
  loop
    execute format('alter table public.sales_documents drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.sales_documents
  add constraint sales_documents_document_type_status_check
  check (
    (document_type = 'quote' and status in ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'))
    or (document_type = 'order' and status in ('draft', 'confirmed', 'partially_delivered', 'delivered', 'cancelled'))
    or (document_type = 'delivery_note' and status in ('draft', 'validated', 'delivered', 'cancelled'))
    or (document_type = 'return_note' and status in ('draft', 'validated', 'cancelled'))
  );

create index if not exists sales_documents_related_order_id_idx on public.sales_documents (related_order_id);
create index if not exists sales_documents_related_delivery_id_idx on public.sales_documents (related_delivery_id);
create index if not exists sales_documents_stock_updated_at_idx on public.sales_documents (stock_updated_at);
create index if not exists sales_document_lines_source_line_id_idx on public.sales_document_lines (source_line_id);
create index if not exists stock_moves_source_document_id_idx on public.stock_moves (source_document_id);
create index if not exists stock_moves_source_line_id_idx on public.stock_moves (source_line_id);
create index if not exists stock_moves_movement_date_idx on public.stock_moves (movement_date);

create or replace function public.generate_sales_document_number()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  period text;
  next_number integer;
begin
  if new.document_number is not null and length(trim(new.document_number)) > 0 then
    return new;
  end if;

  prefix := case new.document_type
    when 'quote' then 'DEV'
    when 'order' then 'CMD'
    when 'delivery_note' then 'BL'
    when 'return_note' then 'BR'
    else 'DOC'
  end;
  period := to_char(coalesce(new.document_date, current_date), 'YYMM');

  select coalesce(max((regexp_match(document_number, '^[A-Z]+-[0-9]{4}-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.sales_documents
  where organization_id = new.organization_id
    and document_type = new.document_type
    and document_number like prefix || '-' || period || '-%';

  new.document_number := prefix || '-' || period || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

create or replace function public.update_stock_level()
returns trigger language plpgsql as $$
begin
  if new.warehouse_id is null then
    return new;
  end if;

  insert into stock_levels (organization_id, warehouse_id, product_id, quantity)
  values (
    new.organization_id,
    new.warehouse_id,
    new.product_id,
    case when coalesce(new.direction, case when new.move_type::text in ('out', 'delivery_out', 'adjustment_out') then 'out' else 'in' end) = 'out'
      then -new.quantity
      else new.quantity
    end
  )
  on conflict (organization_id, warehouse_id, product_id)
  do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
  return new;
end;
$$;

alter table public.stock_moves enable row level security;

drop policy if exists "stock_moves_select_org_members" on public.stock_moves;
create policy "stock_moves_select_org_members"
on public.stock_moves for select
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = stock_moves.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "stock_moves_insert_org_members" on public.stock_moves;
create policy "stock_moves_insert_org_members"
on public.stock_moves for insert
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = stock_moves.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

grant select, insert on public.stock_moves to authenticated;
