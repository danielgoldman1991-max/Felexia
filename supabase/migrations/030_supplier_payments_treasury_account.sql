alter table public.supplier_payments
  add column if not exists treasury_account_id uuid null references public.treasury_accounts(id) on delete set null;

create index if not exists supplier_payments_treasury_account_id_idx
  on public.supplier_payments (treasury_account_id);
