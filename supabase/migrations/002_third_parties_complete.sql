alter table third_parties alter column type drop not null;

alter table third_parties add column if not exists code text;
alter table third_parties add column if not exists primary_type text;
alter table third_parties add column if not exists types text[] not null default '{}';
alter table third_parties add column if not exists alternative_name text;
alter table third_parties add column if not exists postal_code text;
alter table third_parties add column if not exists department text;
alter table third_parties add column if not exists mobile text;
alter table third_parties add column if not exists fax text;
alter table third_parties add column if not exists website text;
alter table third_parties add column if not exists patente text;
alter table third_parties add column if not exists vat_subject boolean not null default false;
alter table third_parties add column if not exists vat_number text;
alter table third_parties add column if not exists cumulative_revenue numeric(14,2) not null default 0 check (cumulative_revenue >= 0);
alter table third_parties add column if not exists current_outstanding numeric(14,2) not null default 0 check (current_outstanding >= 0);
alter table third_parties add column if not exists default_discount_rate numeric(6,2) not null default 0 check (default_discount_rate >= 0);
alter table third_parties add column if not exists customer_category text;
alter table third_parties add column if not exists risk_level text;
alter table third_parties add column if not exists preferred_payment_method text;
alter table third_parties add column if not exists prospect_source text;
alter table third_parties add column if not exists prospect_status text;
alter table third_parties add column if not exists potential_value numeric(14,2) not null default 0 check (potential_value >= 0);
alter table third_parties add column if not exists next_follow_up_date date;
alter table third_parties add column if not exists interest_level text;
alter table third_parties add column if not exists sales_owner text;
alter table third_parties add column if not exists prospect_notes text;
alter table third_parties add column if not exists supplier_product_categories text;
alter table third_parties add column if not exists supplier_payment_terms text;
alter table third_parties add column if not exists supplier_rating integer check (supplier_rating between 1 and 5);
alter table third_parties add column if not exists supplier_delivery_delay_days integer check (supplier_delivery_delay_days >= 0);
alter table third_parties add column if not exists supplier_main_contact text;
alter table third_parties add column if not exists supplier_payment_method text;
alter table third_parties add column if not exists supplier_notes text;
alter table third_parties add column if not exists converted_from_prospect_id uuid references third_parties(id);
alter table third_parties add column if not exists converted_to_customer_id uuid references third_parties(id);
alter table third_parties add column if not exists converted_at timestamptz;

update third_parties
set cumulative_revenue = coalesce(cumulative_revenue, 0),
    current_outstanding = coalesce(current_outstanding, 0),
    default_discount_rate = coalesce(default_discount_rate, 0),
    potential_value = coalesce(potential_value, 0),
    credit_limit = coalesce(credit_limit, 0),
    payment_terms_days = coalesce(payment_terms_days, 30)
where cumulative_revenue is null
   or current_outstanding is null
   or default_discount_rate is null
   or potential_value is null
   or credit_limit is null
   or payment_terms_days is null;

alter table third_parties alter column cumulative_revenue set default 0;
alter table third_parties alter column cumulative_revenue set not null;
alter table third_parties alter column current_outstanding set default 0;
alter table third_parties alter column current_outstanding set not null;
alter table third_parties alter column default_discount_rate set default 0;
alter table third_parties alter column default_discount_rate set not null;
alter table third_parties alter column potential_value set default 0;
alter table third_parties alter column potential_value set not null;
alter table third_parties alter column credit_limit set default 0;
alter table third_parties alter column payment_terms_days set default 30;

update third_parties
set types = case
  when type = 'customer' then array['customer']
  when type = 'supplier' then array['supplier']
  when type = 'both' then array['customer', 'supplier']
  else coalesce(nullif(types, '{}'), array['prospect'])
end
where types = '{}';

update third_parties
set primary_type = coalesce(primary_type, types[1], 'prospect'),
    country = coalesce(country, 'MA'),
    status = case when status = 'inactive' then 'inactive' else status end
where primary_type is null or country is null;

alter table third_parties drop constraint if exists third_parties_status_check;
alter table third_parties add constraint third_parties_status_check
  check (status in ('active', 'inactive', 'blocked', 'archived'));

alter table third_parties drop constraint if exists third_parties_primary_type_check;
alter table third_parties add constraint third_parties_primary_type_check
  check (primary_type in ('prospect', 'customer', 'supplier'));

alter table third_parties drop constraint if exists third_parties_types_check;
alter table third_parties add constraint third_parties_types_check
  check (
    cardinality(types) >= 1
    and types <@ array['prospect', 'customer', 'supplier']::text[]
  );

create unique index if not exists third_parties_org_code_unique
  on third_parties (organization_id, code)
  where code is not null;

create index if not exists third_parties_types_gin_idx on third_parties using gin (types);
create index if not exists third_parties_code_idx on third_parties (code);
create index if not exists third_parties_city_idx on third_parties (city);
create index if not exists third_parties_ice_idx on third_parties (ice);
create index if not exists third_parties_vat_subject_idx on third_parties (vat_subject);
create index if not exists third_parties_archived_at_idx on third_parties (archived_at);

create table if not exists third_party_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  third_party_id uuid not null references third_parties(id) on delete cascade,
  full_name text not null,
  job_title text,
  phone text,
  mobile text,
  email text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists third_party_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  third_party_id uuid not null references third_parties(id) on delete cascade,
  label text not null,
  type text not null default 'other' check (type in ('billing', 'delivery', 'other')),
  address text not null,
  postal_code text,
  city text,
  country text not null default 'MA',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists third_party_contacts_org_idx on third_party_contacts (organization_id);
create index if not exists third_party_contacts_party_idx on third_party_contacts (third_party_id);
create index if not exists third_party_contacts_primary_idx on third_party_contacts (organization_id, third_party_id, is_primary);
create index if not exists third_party_addresses_org_idx on third_party_addresses (organization_id);
create index if not exists third_party_addresses_party_idx on third_party_addresses (third_party_id);
create index if not exists third_party_addresses_default_idx on third_party_addresses (organization_id, third_party_id, is_default);

create or replace function generate_third_party_code()
returns trigger language plpgsql as $$
declare
  seq_key text;
  seq_prefix text;
  seq_year integer := extract(year from now())::integer;
  seq_next integer;
  yy text := to_char(now(), 'YY');
  mm text := to_char(now(), 'MM');
begin
  if new.code is not null then
    return new;
  end if;

  new.primary_type := coalesce(new.primary_type, new.types[1], 'prospect');
  seq_key := 'THIRD_PARTY_' || new.primary_type || '_' || yy || mm;
  seq_prefix := case new.primary_type
    when 'customer' then 'CU'
    when 'supplier' then 'SU'
    else 'PR'
  end || yy || mm || '-';

  select next_number into seq_next
  from numbering_sequences
  where organization_id = new.organization_id
    and document_type = seq_key
    and current_year = seq_year
  for update;

  if seq_next is null then
    seq_next := 1;
    insert into numbering_sequences (organization_id, document_type, prefix, current_year, next_number)
    values (new.organization_id, seq_key, seq_prefix, seq_year, 2);
  else
    update numbering_sequences
    set next_number = next_number + 1, updated_at = now()
    where organization_id = new.organization_id
      and document_type = seq_key
      and current_year = seq_year;
  end if;

  new.code := seq_prefix || lpad(seq_next::text, 5, '0');
  return new;
end;
$$;

create or replace function normalize_third_party_numbers()
returns trigger language plpgsql as $$
begin
  new.cumulative_revenue := coalesce(new.cumulative_revenue, 0);
  new.current_outstanding := coalesce(new.current_outstanding, 0);
  new.default_discount_rate := coalesce(new.default_discount_rate, 0);
  new.potential_value := coalesce(new.potential_value, 0);
  new.credit_limit := coalesce(new.credit_limit, 0);
  new.payment_terms_days := coalesce(new.payment_terms_days, 30);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'third_parties_normalize_numbers') then
    create trigger third_parties_normalize_numbers
    before insert or update on third_parties
    for each row execute function normalize_third_party_numbers();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'third_parties_generate_code') then
    create trigger third_parties_generate_code
    before insert on third_parties
    for each row execute function generate_third_party_code();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'third_party_contacts_set_updated_at') then
    create trigger third_party_contacts_set_updated_at
    before update on third_party_contacts
    for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'third_party_addresses_set_updated_at') then
    create trigger third_party_addresses_set_updated_at
    before update on third_party_addresses
    for each row execute function set_updated_at();
  end if;
end $$;

alter table third_party_contacts enable row level security;
alter table third_party_addresses enable row level security;

drop policy if exists third_party_contacts_org_member_all on third_party_contacts;
create policy third_party_contacts_org_member_all
on third_party_contacts
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists third_party_addresses_org_member_all on third_party_addresses;
create policy third_party_addresses_org_member_all
on third_party_addresses
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));
