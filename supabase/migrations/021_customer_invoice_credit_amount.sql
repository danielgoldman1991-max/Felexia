alter table public.customer_invoices
add column if not exists credit_amount numeric(14,2) not null default 0;

do $$
begin
  begin
    alter table public.customer_invoices
      add constraint customer_invoices_credit_amount_check check (credit_amount >= 0);
  exception
    when duplicate_object then null;
  end;
end $$;

create index if not exists customer_invoices_credit_amount_idx on public.customer_invoices (credit_amount);
