-- Drop the old unnamed table-level check that only allows quote/order/delivery_note
alter table public.sales_documents drop constraint if exists sales_documents_check;

-- Drop any remaining column-level check on document_type (from migration 005 line 8)
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

-- Recreate the combined constraint including return_note (idempotent)
alter table public.sales_documents
  drop constraint if exists sales_documents_document_type_status_check;

alter table public.sales_documents
  add constraint sales_documents_document_type_status_check
  check (
    (document_type = 'quote' and status in ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'))
    or (document_type = 'order' and status in ('draft', 'confirmed', 'partially_delivered', 'delivered', 'cancelled'))
    or (document_type = 'delivery_note' and status in ('draft', 'validated', 'delivered', 'cancelled'))
    or (document_type = 'return_note' and status in ('draft', 'validated', 'cancelled'))
  );
