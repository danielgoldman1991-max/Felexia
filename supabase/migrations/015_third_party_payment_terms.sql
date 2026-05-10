-- Add payment terms/method fields to third_parties
alter table public.third_parties add column if not exists payment_terms text null;
alter table public.third_parties add column if not exists payment_method text null;
alter table public.third_parties add column if not exists custom_payment_terms text null;
alter table public.third_parties add column if not exists custom_payment_method text null;
