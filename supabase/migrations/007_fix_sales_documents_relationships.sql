-- Felexia - Fix explicit self-referencing relationships for sales documents.
-- Idempotent corrective migration for PostgREST/Supabase schema cache.

alter table public.sales_documents
add column if not exists related_order_id uuid null;

alter table public.sales_documents
add column if not exists related_delivery_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_documents_related_order_id_fkey'
      and conrelid = 'public.sales_documents'::regclass
  ) then
    alter table public.sales_documents
    add constraint sales_documents_related_order_id_fkey
    foreign key (related_order_id)
    references public.sales_documents(id)
    on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_documents_related_delivery_id_fkey'
      and conrelid = 'public.sales_documents'::regclass
  ) then
    alter table public.sales_documents
    add constraint sales_documents_related_delivery_id_fkey
    foreign key (related_delivery_id)
    references public.sales_documents(id)
    on delete set null;
  end if;
end $$;

create index if not exists sales_documents_related_order_id_idx
on public.sales_documents (related_order_id);

create index if not exists sales_documents_related_delivery_id_idx
on public.sales_documents (related_delivery_id);
