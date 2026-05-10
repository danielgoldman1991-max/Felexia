-- Add payment terms/method fields to customer_invoices
alter table public.customer_invoices add column if not exists payment_terms text null;
alter table public.customer_invoices add column if not exists payment_method text null;
alter table public.customer_invoices add column if not exists custom_payment_terms text null;
alter table public.customer_invoices add column if not exists custom_payment_method text null;
