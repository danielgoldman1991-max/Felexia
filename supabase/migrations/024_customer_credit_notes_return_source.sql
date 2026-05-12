alter table public.customer_credit_notes
  add column if not exists source_return_id uuid null references public.sales_documents(id) on delete set null;

create index if not exists customer_credit_notes_source_return_id_idx
  on public.customer_credit_notes (source_return_id);
