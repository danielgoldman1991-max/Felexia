-- Fix stock_moves FK constraints to accept purchase_documents as source
-- 022 should have dropped these FKs but only dropped NOT NULL + added comment.
-- Both source_document_id and source_line_id can reference purchase or sales documents
-- depending on move_type, so we drop the sales-only FK constraints.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_source_document_id_fkey'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves drop constraint stock_moves_source_document_id_fkey;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'stock_moves_source_line_id_fkey'
      and conrelid = 'public.stock_moves'::regclass
  ) then
    alter table public.stock_moves drop constraint stock_moves_source_line_id_fkey;
  end if;
end $$;
