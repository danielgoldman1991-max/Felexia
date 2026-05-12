alter table public.purchase_documents
  add column if not exists warehouse_id uuid null references public.warehouses(id) on delete set null;

create index if not exists purchase_documents_warehouse_id_idx
  on public.purchase_documents (warehouse_id);
