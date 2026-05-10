create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  third_party_id uuid not null references public.third_parties(id),
  payment_number text not null,
  payment_date date not null default current_date,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

drop trigger if exists customer_payment_updates_invoice on public.customer_payments;
drop trigger if exists customer_payments_number on public.customer_payments;

alter table public.customer_payments add column if not exists payment_number text null;
alter table public.customer_payments add column if not exists third_party_id uuid null references public.third_parties(id);
alter table public.customer_payments add column if not exists customer_id uuid null references public.third_parties(id);
alter table public.customer_payments add column if not exists value_date date null;
alter table public.customer_payments add column if not exists allocated_amount numeric(14,2) not null default 0;
alter table public.customer_payments add column if not exists available_amount numeric(14,2) not null default 0;
alter table public.customer_payments add column if not exists currency text not null default 'MAD';
alter table public.customer_payments add column if not exists payment_method text null;
alter table public.customer_payments add column if not exists reference text null;
alter table public.customer_payments add column if not exists bank_name text null;
alter table public.customer_payments add column if not exists check_number text null;
alter table public.customer_payments add column if not exists transfer_reference text null;
alter table public.customer_payments add column if not exists due_date date null;
alter table public.customer_payments add column if not exists payment_type text not null default 'customer_payment';
alter table public.customer_payments add column if not exists source_type text null;
alter table public.customer_payments add column if not exists source_invoice_id uuid null references public.customer_invoices(id) on delete set null;
alter table public.customer_payments add column if not exists notes text null;
alter table public.customer_payments add column if not exists internal_notes text null;
alter table public.customer_payments add column if not exists confirmed_at timestamptz null;
alter table public.customer_payments add column if not exists cancelled_at timestamptz null;
alter table public.customer_payments add column if not exists archived_at timestamptz null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_payments'
      and column_name = 'third_party_id'
  ) then
    update public.customer_payments
    set customer_id = third_party_id
    where customer_id is null and third_party_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_payments'
      and column_name = 'customer_id'
  ) then
    update public.customer_payments
    set third_party_id = customer_id
    where third_party_id is null and customer_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_payments'
      and column_name = 'method'
  ) then
    update public.customer_payments
    set payment_method = method
    where payment_method is null and method is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_payments'
      and column_name = 'number'
  ) then
    update public.customer_payments
    set payment_number = coalesce(nullif(number, ''), 'LEGACY-' || left(id::text, 8))
    where payment_number is null;
  end if;

  update public.customer_payments
  set payment_number = 'LEGACY-' || left(id::text, 8)
  where payment_number is null;

  alter table public.customer_payments
    alter column status type text using status::text;
exception
  when undefined_column then null;
end $$;

alter table public.customer_payments alter column payment_number set not null;
alter table public.customer_payments alter column third_party_id set not null;
alter table public.customer_payments alter column payment_method set default 'bank_transfer';
update public.customer_payments set payment_method = coalesce(payment_method, 'bank_transfer');
alter table public.customer_payments alter column payment_method set not null;
alter table public.customer_payments alter column available_amount set default 0;
update public.customer_payments
set available_amount = case
  when available_amount = 0 and allocated_amount = 0 then amount
  else available_amount
end;

do $$
begin
  alter table public.customer_payments
    add constraint customer_payments_payment_number_org_unique unique (organization_id, payment_number);
exception
  when duplicate_object then null;
  when sqlstate '42P07' then null;
end $$;

alter table public.customer_payments drop constraint if exists customer_payments_amount_check;
alter table public.customer_payments add constraint customer_payments_amount_check
check (amount > 0 and allocated_amount >= 0 and available_amount >= 0 and allocated_amount <= amount);

alter table public.customer_payments drop constraint if exists customer_payments_status_check;
alter table public.customer_payments add constraint customer_payments_status_check
check (status in ('draft', 'confirmed', 'partially_allocated', 'allocated', 'cancelled'));

alter table public.customer_payments drop constraint if exists customer_payments_payment_type_check;
alter table public.customer_payments add constraint customer_payments_payment_type_check
check (payment_type in ('customer_payment', 'advance_payment', 'deposit', 'overpayment', 'refund_received', 'other'));

alter table public.customer_payments drop constraint if exists customer_payments_source_type_check;
alter table public.customer_payments add constraint customer_payments_source_type_check
check (source_type is null or source_type in ('manual', 'invoice', 'advance', 'bank_import'));

create table if not exists public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.customer_payments(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  third_party_id uuid not null references public.third_parties(id),
  allocation_date date not null default current_date,
  amount numeric(14,2) not null,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  constraint customer_payment_allocations_amount_check check (amount > 0)
);

alter table public.customer_payment_allocations add column if not exists third_party_id uuid null references public.third_parties(id);
alter table public.customer_payment_allocations add column if not exists customer_id uuid null references public.third_parties(id);

update public.customer_payment_allocations
set third_party_id = customer_id
where third_party_id is null and customer_id is not null;

update public.customer_payment_allocations
set customer_id = third_party_id
where customer_id is null and third_party_id is not null;

alter table public.customer_payment_allocations alter column third_party_id set not null;

create index if not exists customer_payments_organization_id_idx on public.customer_payments (organization_id);
create index if not exists customer_payments_third_party_id_idx on public.customer_payments (third_party_id);
create index if not exists customer_payments_customer_id_idx on public.customer_payments (customer_id);
create index if not exists customer_payments_payment_number_idx on public.customer_payments (payment_number);
create index if not exists customer_payments_payment_date_idx on public.customer_payments (payment_date);
create index if not exists customer_payments_status_idx on public.customer_payments (status);
create index if not exists customer_payments_payment_method_idx on public.customer_payments (payment_method);
create index if not exists customer_payments_source_invoice_id_idx on public.customer_payments (source_invoice_id);
create index if not exists customer_payments_archived_at_idx on public.customer_payments (archived_at);

create index if not exists customer_payment_allocations_organization_id_idx on public.customer_payment_allocations (organization_id);
create index if not exists customer_payment_allocations_payment_id_idx on public.customer_payment_allocations (payment_id);
create index if not exists customer_payment_allocations_invoice_id_idx on public.customer_payment_allocations (invoice_id);
create index if not exists customer_payment_allocations_third_party_id_idx on public.customer_payment_allocations (third_party_id);
create index if not exists customer_payment_allocations_customer_id_idx on public.customer_payment_allocations (customer_id);
create index if not exists customer_payment_allocations_allocation_date_idx on public.customer_payment_allocations (allocation_date);

alter table public.customer_payments enable row level security;
alter table public.customer_payment_allocations enable row level security;

drop policy if exists customer_payments_org_member_all on public.customer_payments;
create policy customer_payments_org_member_all
on public.customer_payments
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists customer_payment_allocations_org_member_all on public.customer_payment_allocations;
create policy customer_payment_allocations_org_member_all
on public.customer_payment_allocations
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

create or replace function public.generate_customer_payment_number()
returns trigger language plpgsql as $$
declare
  seq_key text;
  seq_prefix text;
  seq_year integer := extract(year from coalesce(new.payment_date, current_date))::integer;
  seq_next integer;
  yy text := to_char(coalesce(new.payment_date, current_date), 'YY');
  mm text := to_char(coalesce(new.payment_date, current_date), 'MM');
begin
  if new.payment_number is not null and new.payment_number <> '' then
    return new;
  end if;

  seq_key := 'CUSTOMER_PAYMENT_' || yy || mm;
  seq_prefix := 'REG-' || yy || mm || '-';

  select next_number into seq_next
  from public.numbering_sequences
  where organization_id = new.organization_id
    and document_type = seq_key
    and current_year = seq_year
  for update;

  if seq_next is null then
    seq_next := 1;
    insert into public.numbering_sequences (organization_id, document_type, prefix, current_year, next_number)
    values (new.organization_id, seq_key, seq_prefix, seq_year, 2);
  else
    update public.numbering_sequences
    set next_number = next_number + 1, updated_at = now()
    where organization_id = new.organization_id
      and document_type = seq_key
      and current_year = seq_year;
  end if;

  new.payment_number := seq_prefix || lpad(seq_next::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists customer_payments_reg_number on public.customer_payments;
create trigger customer_payments_reg_number
before insert on public.customer_payments
for each row execute function public.generate_customer_payment_number();

drop trigger if exists customer_payments_set_updated_at on public.customer_payments;
create trigger customer_payments_set_updated_at
before update on public.customer_payments
for each row execute function public.set_updated_at();
