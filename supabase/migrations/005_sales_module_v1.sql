-- Felexia - Sales module V1
-- New simplified sales flow: quote -> order -> delivery note.
-- This migration is additive and does not drop or alter legacy commerce tables.

create table if not exists public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('quote', 'order', 'delivery_note')),
  document_number text not null,
  customer_id uuid not null references public.third_parties(id),
  source_document_id uuid null references public.sales_documents(id),
  document_date date not null default current_date,
  valid_until date null,
  expected_delivery_date date null,
  status text not null default 'draft',
  subtotal_ht numeric(14,2) not null default 0 check (subtotal_ht >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  total_ttc numeric(14,2) not null default 0 check (total_ttc >= 0),
  notes text,
  internal_notes text,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  unique (organization_id, document_number),
  check (
    (document_type = 'quote' and status in ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'))
    or (document_type = 'order' and status in ('draft', 'confirmed', 'delivered', 'cancelled'))
    or (document_type = 'delivery_note' and status in ('draft', 'validated', 'delivered', 'cancelled'))
  )
);

create table if not exists public.sales_document_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.sales_documents(id) on delete cascade,
  line_order integer not null default 1,
  product_id uuid null references public.products(id),
  product_name text,
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit_id uuid null references public.units(id),
  unit_name text,
  unit_price_ht numeric(14,2) not null default 0 check (unit_price_ht >= 0),
  discount_rate numeric(5,2) not null default 0 check (discount_rate >= 0 and discount_rate <= 100),
  tax_rate_id uuid null references public.tax_rates(id),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  subtotal_ht numeric(14,2) not null default 0 check (subtotal_ht >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_ttc numeric(14,2) not null default 0 check (total_ttc >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_documents_organization_id_idx on public.sales_documents (organization_id);
create index if not exists sales_documents_document_type_idx on public.sales_documents (document_type);
create index if not exists sales_documents_status_idx on public.sales_documents (status);
create index if not exists sales_documents_customer_id_idx on public.sales_documents (customer_id);
create index if not exists sales_documents_document_date_idx on public.sales_documents (document_date);
create index if not exists sales_documents_created_at_idx on public.sales_documents (created_at);
create index if not exists sales_documents_archived_at_idx on public.sales_documents (archived_at);
create index if not exists sales_document_lines_organization_id_idx on public.sales_document_lines (organization_id);
create index if not exists sales_document_lines_document_id_idx on public.sales_document_lines (document_id);
create index if not exists sales_document_lines_product_id_idx on public.sales_document_lines (product_id);

create or replace function public.set_sales_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_documents_updated_at on public.sales_documents;
create trigger sales_documents_updated_at
before update on public.sales_documents
for each row execute function public.set_sales_updated_at();

drop trigger if exists sales_document_lines_updated_at on public.sales_document_lines;
create trigger sales_document_lines_updated_at
before update on public.sales_document_lines
for each row execute function public.set_sales_updated_at();

create or replace function public.generate_sales_document_number()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  period text;
  next_number integer;
begin
  if new.document_number is not null and length(trim(new.document_number)) > 0 then
    return new;
  end if;

  prefix := case new.document_type
    when 'quote' then 'DEV'
    when 'order' then 'CMD'
    when 'delivery_note' then 'BL'
    else 'DOC'
  end;
  period := to_char(coalesce(new.document_date, current_date), 'YYMM');

  select coalesce(max((regexp_match(document_number, '^[A-Z]+-[0-9]{4}-([0-9]+)$'))[1]::integer), 0) + 1
    into next_number
  from public.sales_documents
  where organization_id = new.organization_id
    and document_type = new.document_type
    and document_number like prefix || '-' || period || '-%';

  new.document_number := prefix || '-' || period || '-' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists sales_documents_generate_number on public.sales_documents;
create trigger sales_documents_generate_number
before insert on public.sales_documents
for each row execute function public.generate_sales_document_number();

alter table public.sales_documents enable row level security;
alter table public.sales_document_lines enable row level security;

drop policy if exists "sales_documents_select_org_members" on public.sales_documents;
create policy "sales_documents_select_org_members"
on public.sales_documents for select
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_documents.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "sales_documents_insert_org_members" on public.sales_documents;
create policy "sales_documents_insert_org_members"
on public.sales_documents for insert
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_documents.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "sales_documents_update_org_members" on public.sales_documents;
create policy "sales_documents_update_org_members"
on public.sales_documents for update
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_documents.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_documents.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "sales_document_lines_select_org_members" on public.sales_document_lines;
create policy "sales_document_lines_select_org_members"
on public.sales_document_lines for select
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_document_lines.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists "sales_document_lines_insert_org_members" on public.sales_document_lines;
create policy "sales_document_lines_insert_org_members"
on public.sales_document_lines for insert
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_document_lines.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and exists (
    select 1 from public.sales_documents sd
    where sd.id = sales_document_lines.document_id
      and sd.organization_id = sales_document_lines.organization_id
  )
);

drop policy if exists "sales_document_lines_update_org_members" on public.sales_document_lines;
create policy "sales_document_lines_update_org_members"
on public.sales_document_lines for update
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_document_lines.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_document_lines.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and exists (
    select 1 from public.sales_documents sd
    where sd.id = sales_document_lines.document_id
      and sd.organization_id = sales_document_lines.organization_id
  )
);

drop policy if exists "sales_document_lines_delete_org_members" on public.sales_document_lines;
create policy "sales_document_lines_delete_org_members"
on public.sales_document_lines for delete
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = sales_document_lines.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

grant select, insert, update on public.sales_documents to authenticated;
grant select, insert, update, delete on public.sales_document_lines to authenticated;
