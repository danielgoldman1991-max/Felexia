create table if not exists public.customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  credit_note_number text not null,
  customer_id uuid not null references public.third_parties(id),
  source_invoice_id uuid null references public.customer_invoices(id),
  source_type text not null default 'manual',
  credit_note_date date not null default current_date,
  status text not null default 'draft',
  subtotal_ht numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  applied_amount numeric(14,2) not null default 0,
  available_amount numeric(14,2) not null default 0,
  currency text not null default 'MAD',
  reason text null,
  internal_notes text null,
  notes text null,
  validated_at timestamptz null,
  cancelled_at timestamptz null,
  created_by uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz null,
  constraint customer_credit_notes_source_type_check check (source_type in ('manual', 'invoice_total', 'invoice_partial', 'return', 'commercial_gesture', 'correction')),
  constraint customer_credit_notes_status_check check (status in ('draft', 'validated', 'applied', 'partially_applied', 'cancelled')),
  constraint customer_credit_notes_amounts_check check (
    total_ttc >= 0 and applied_amount >= 0 and available_amount >= 0 and applied_amount <= total_ttc
  ),
  constraint customer_credit_notes_number_org_unique unique (organization_id, credit_note_number)
);

create table if not exists public.customer_credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  credit_note_id uuid not null references public.customer_credit_notes(id) on delete cascade,
  source_invoice_line_id uuid null references public.customer_invoice_lines(id),
  line_order integer not null default 1,
  product_id uuid null references public.products(id),
  product_name text null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_id uuid null references public.units(id),
  unit_name text null,
  unit_price_ht numeric(14,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  tax_rate_id uuid null references public.tax_rates(id),
  tax_rate numeric(5,2) not null default 0,
  subtotal_ht numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint customer_credit_note_lines_values_check check (
    quantity > 0 and unit_price_ht >= 0 and discount_rate between 0 and 100 and tax_rate between 0 and 100
  )
);

create table if not exists public.customer_credit_note_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  credit_note_id uuid not null references public.customer_credit_notes(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id),
  customer_id uuid not null references public.third_parties(id),
  application_date date not null default current_date,
  amount numeric(14,2) not null,
  notes text null,
  created_by uuid null,
  created_at timestamptz default now(),
  cancelled_at timestamptz null,
  constraint customer_credit_note_applications_amount_check check (amount > 0)
);

create index if not exists customer_credit_notes_organization_id_idx on public.customer_credit_notes (organization_id);
create index if not exists customer_credit_notes_customer_id_idx on public.customer_credit_notes (customer_id);
create index if not exists customer_credit_notes_credit_note_number_idx on public.customer_credit_notes (credit_note_number);
create index if not exists customer_credit_notes_source_invoice_id_idx on public.customer_credit_notes (source_invoice_id);
create index if not exists customer_credit_notes_status_idx on public.customer_credit_notes (status);
create index if not exists customer_credit_notes_credit_note_date_idx on public.customer_credit_notes (credit_note_date);
create index if not exists customer_credit_notes_archived_at_idx on public.customer_credit_notes (archived_at);

create index if not exists customer_credit_note_lines_organization_id_idx on public.customer_credit_note_lines (organization_id);
create index if not exists customer_credit_note_lines_credit_note_id_idx on public.customer_credit_note_lines (credit_note_id);
create index if not exists customer_credit_note_lines_product_id_idx on public.customer_credit_note_lines (product_id);

create index if not exists customer_credit_note_applications_organization_id_idx on public.customer_credit_note_applications (organization_id);
create index if not exists customer_credit_note_applications_credit_note_id_idx on public.customer_credit_note_applications (credit_note_id);
create index if not exists customer_credit_note_applications_invoice_id_idx on public.customer_credit_note_applications (invoice_id);
create index if not exists customer_credit_note_applications_customer_id_idx on public.customer_credit_note_applications (customer_id);

alter table public.customer_credit_notes enable row level security;
alter table public.customer_credit_note_lines enable row level security;
alter table public.customer_credit_note_applications enable row level security;

drop policy if exists customer_credit_notes_org_member_all on public.customer_credit_notes;
create policy customer_credit_notes_org_member_all on public.customer_credit_notes
for all using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists customer_credit_note_lines_org_member_all on public.customer_credit_note_lines;
create policy customer_credit_note_lines_org_member_all on public.customer_credit_note_lines
for all using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists customer_credit_note_applications_org_member_all on public.customer_credit_note_applications;
create policy customer_credit_note_applications_org_member_all on public.customer_credit_note_applications
for all using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

create or replace function public.generate_customer_credit_note_number()
returns trigger language plpgsql as $$
declare
  yy text := to_char(coalesce(new.credit_note_date, current_date), 'YY');
  mm text := to_char(coalesce(new.credit_note_date, current_date), 'MM');
  seq_prefix text := 'AV-' || yy || mm || '-';
  seq_next integer;
begin
  if new.credit_note_number is not null and new.credit_note_number <> '' then
    return new;
  end if;

  select coalesce(max((right(credit_note_number, 5))::integer), 0) + 1
    into seq_next
  from public.customer_credit_notes
  where organization_id = new.organization_id
    and credit_note_number like seq_prefix || '%';

  new.credit_note_number := seq_prefix || lpad(seq_next::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists customer_credit_notes_number on public.customer_credit_notes;
create trigger customer_credit_notes_number
before insert on public.customer_credit_notes
for each row execute function public.generate_customer_credit_note_number();

drop trigger if exists customer_credit_notes_set_updated_at on public.customer_credit_notes;
create trigger customer_credit_notes_set_updated_at
before update on public.customer_credit_notes
for each row execute function public.set_updated_at();
