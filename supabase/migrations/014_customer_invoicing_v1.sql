create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.third_parties(id),
  source_type text null,
  source_document_id uuid null references public.sales_documents(id) on delete set null,
  source_order_id uuid null references public.sales_documents(id) on delete set null,
  source_delivery_id uuid null references public.sales_documents(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date null,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  payment_terms_days integer not null default 0,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  subtotal_ht numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  notes text null,
  internal_notes text null,
  validated_at timestamptz null,
  sent_at timestamptz null,
  cancelled_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint customer_invoices_source_type_check check (source_type is null or source_type in ('manual', 'order', 'delivery_note', 'grouped_delivery_notes')),
  constraint customer_invoices_status_check check (status in ('draft', 'validated', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  constraint customer_invoices_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid')),
  constraint customer_invoices_amounts_check check (
    subtotal_ht >= 0 and discount_total >= 0 and tax_total >= 0 and total_ttc >= 0
    and paid_amount >= 0 and remaining_amount >= 0
  ),
  unique (organization_id, invoice_number)
);

create table if not exists public.customer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  source_line_id uuid null references public.sales_document_lines(id) on delete set null,
  source_document_id uuid null references public.sales_documents(id) on delete set null,
  line_order integer not null default 1,
  product_id uuid null references public.products(id) on delete set null,
  product_name text null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_id uuid null references public.units(id) on delete set null,
  unit_name text null,
  unit_price_ht numeric(14,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  tax_rate_id uuid null references public.tax_rates(id) on delete set null,
  tax_rate numeric(5,2) not null default 0,
  subtotal_ht numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_invoice_lines_quantity_check check (quantity > 0),
  constraint customer_invoice_lines_rate_check check (discount_rate between 0 and 100 and tax_rate between 0 and 100),
  constraint customer_invoice_lines_amounts_check check (
    unit_price_ht >= 0 and subtotal_ht >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_ttc >= 0
  )
);

create index if not exists customer_invoices_organization_id_idx on public.customer_invoices (organization_id);
create index if not exists customer_invoices_invoice_number_idx on public.customer_invoices (invoice_number);
create index if not exists customer_invoices_customer_id_idx on public.customer_invoices (customer_id);
create index if not exists customer_invoices_status_idx on public.customer_invoices (status);
create index if not exists customer_invoices_payment_status_idx on public.customer_invoices (payment_status);
create index if not exists customer_invoices_invoice_date_idx on public.customer_invoices (invoice_date);
create index if not exists customer_invoices_due_date_idx on public.customer_invoices (due_date);
create index if not exists customer_invoices_archived_at_idx on public.customer_invoices (archived_at);

create index if not exists customer_invoice_lines_organization_id_idx on public.customer_invoice_lines (organization_id);
create index if not exists customer_invoice_lines_invoice_id_idx on public.customer_invoice_lines (invoice_id);
create index if not exists customer_invoice_lines_product_id_idx on public.customer_invoice_lines (product_id);
create index if not exists customer_invoice_lines_source_document_id_idx on public.customer_invoice_lines (source_document_id);
create index if not exists customer_invoice_lines_source_line_id_idx on public.customer_invoice_lines (source_line_id);

alter table public.customer_invoices enable row level security;
alter table public.customer_invoice_lines enable row level security;

drop policy if exists customer_invoices_org_member_all on public.customer_invoices;
create policy customer_invoices_org_member_all
on public.customer_invoices
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists customer_invoice_lines_org_member_all on public.customer_invoice_lines;
create policy customer_invoice_lines_org_member_all
on public.customer_invoice_lines
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

create or replace function public.generate_customer_invoice_number()
returns trigger language plpgsql as $$
declare
  seq_key text;
  seq_prefix text;
  seq_year integer := extract(year from coalesce(new.invoice_date, current_date))::integer;
  seq_next integer;
  yy text := to_char(coalesce(new.invoice_date, current_date), 'YY');
  mm text := to_char(coalesce(new.invoice_date, current_date), 'MM');
begin
  if new.invoice_number is not null and new.invoice_number <> '' then
    return new;
  end if;

  seq_key := 'CUSTOMER_INVOICE_' || yy || mm;
  seq_prefix := 'FAC-' || yy || mm || '-';

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

  new.invoice_number := seq_prefix || lpad(seq_next::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists customer_invoices_number on public.customer_invoices;
create trigger customer_invoices_number
before insert on public.customer_invoices
for each row execute function public.generate_customer_invoice_number();

drop trigger if exists customer_invoices_set_updated_at on public.customer_invoices;
create trigger customer_invoices_set_updated_at
before update on public.customer_invoices
for each row execute function public.set_updated_at();

drop trigger if exists customer_invoice_lines_set_updated_at on public.customer_invoice_lines;
create trigger customer_invoice_lines_set_updated_at
before update on public.customer_invoice_lines
for each row execute function public.set_updated_at();
