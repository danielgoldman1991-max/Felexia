-- Add payment terms/method fields to sales_documents
alter table public.sales_documents add column if not exists payment_terms text null;
alter table public.sales_documents add column if not exists payment_method text null;
alter table public.sales_documents add column if not exists payment_terms_days integer null;
alter table public.sales_documents add column if not exists custom_payment_terms text null;
alter table public.sales_documents add column if not exists custom_payment_method text null;
