alter table public.customer_payments
  add column if not exists treasury_account_id uuid null references public.treasury_accounts(id) on delete set null;

create index if not exists customer_payments_treasury_account_id_idx
  on public.customer_payments (treasury_account_id);
