-- Felexia - Fix delivery/return columns on sales document lines.
-- Idempotent corrective migration. No data is deleted.

alter table public.sales_document_lines
add column if not exists source_line_id uuid null;

alter table public.sales_document_lines
add column if not exists ordered_quantity numeric(14,3) null;

alter table public.sales_document_lines
add column if not exists delivered_quantity numeric(14,3) not null default 0;

alter table public.sales_document_lines
add column if not exists returned_quantity numeric(14,3) not null default 0;

alter table public.sales_document_lines
add column if not exists remaining_quantity numeric(14,3) null;

alter table public.sales_document_lines
add column if not exists stock_move_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_document_lines_source_line_id_fkey'
      and conrelid = 'public.sales_document_lines'::regclass
  ) then
    alter table public.sales_document_lines
    add constraint sales_document_lines_source_line_id_fkey
    foreign key (source_line_id)
    references public.sales_document_lines(id)
    on delete set null;
  end if;

  if to_regclass('public.stock_moves') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'sales_document_lines_stock_move_id_fkey'
        and conrelid = 'public.sales_document_lines'::regclass
    )
  then
    alter table public.sales_document_lines
    add constraint sales_document_lines_stock_move_id_fkey
    foreign key (stock_move_id)
    references public.stock_moves(id)
    on delete set null;
  end if;
end $$;

create index if not exists sales_document_lines_source_line_id_idx
on public.sales_document_lines (source_line_id);

create index if not exists sales_document_lines_stock_move_id_idx
on public.sales_document_lines (stock_move_id);

create index if not exists sales_document_lines_document_id_idx
on public.sales_document_lines (document_id);

create index if not exists sales_document_lines_product_id_idx
on public.sales_document_lines (product_id);
