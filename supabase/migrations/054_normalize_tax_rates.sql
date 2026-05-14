-- Migration 054: Normalize tax_rates — deduplicate and ensure 6 standard rates per org

-- 1. Add missing columns
alter table tax_rates add column if not exists is_active boolean not null default true;
alter table tax_rates add column if not exists sort_order integer;

-- 2. Normalize codes for rows that have none (derive from name then rate)
update tax_rates
set code = case
  when name ilike '0 %' or name ilike '%zero%' or (rate = 0 and not (name ilike '%exon%' or name ilike '%exempt%')) then 'VAT_0'
  when name ilike '7 %' or rate = 7 then 'VAT_7'
  when name ilike '10 %' or rate = 10 then 'VAT_10'
  when name ilike '14 %' or rate = 14 then 'VAT_14'
  when name ilike '20 %' or rate = 20 then 'VAT_20'
  when rate = 0 and (name ilike '%exon%' or name ilike '%exempt%') then 'VAT_EXEMPT'
  else upper(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]', '_', 'g'), '_+', '_', 'g'))
end
where (code is null or code = '') and name is not null and name != '';

update tax_rates
set code = case
  when rate = 0 then 'VAT_0'
  when rate = 7 then 'VAT_7'
  when rate = 10 then 'VAT_10'
  when rate = 14 then 'VAT_14'
  when rate = 20 then 'VAT_20'
  else 'VAT_' || rate::text
end
where (code is null or code = '') and name is not null and name != '';

-- 3. Deduplicate: for each (organization_id, code), keep only one row active
update tax_rates t
set is_active = false
from (
  select id, row_number() over (
    partition by organization_id, code
    order by is_active desc, updated_at desc, id asc
  ) as rn
  from tax_rates
  where code is not null and code != ''
) dup
where t.id = dup.id and dup.rn > 1;

-- 4. Drop old unique constraints
alter table tax_rates drop constraint if exists tax_rates_org_code_key;
alter table tax_rates drop constraint if exists tax_rates_organization_id_name_key;
alter table tax_rates drop constraint if exists tax_rates_org_name_key;

-- 5. Add unique constraint (now that duplicates are cleaned)
alter table tax_rates add constraint tax_rates_org_code_key unique (organization_id, code);

-- 6. Ensure each organization has exactly the 6 standard active rates
insert into tax_rates (organization_id, name, label, rate, code, is_default, is_active, sort_order, status, description)
select o.id, v.name, v.name, v.rate, v.code, v.is_default, true, v.sort_order, 'active', v.description
from organizations o
cross join (values
  ('0 %',      0, 'VAT_0',      false, 1, 'TVA 0 %'),
  ('7 %',      7, 'VAT_7',      false, 2, 'TVA 7 %'),
  ('10 %',    10, 'VAT_10',     false, 3, 'TVA 10 %'),
  ('14 %',    14, 'VAT_14',     false, 4, 'TVA 14 %'),
  ('20 %',    20, 'VAT_20',     true,  5, 'TVA 20 %'),
  ('Exonéré',  0, 'VAT_EXEMPT', false, 6, 'Exonéré de TVA')
) as v(name, rate, code, is_default, sort_order, description)
on conflict (organization_id, code) do update set
  name        = excluded.name,
  label       = excluded.label,
  rate        = excluded.rate,
  is_default  = excluded.is_default,
  is_active   = true,
  sort_order  = excluded.sort_order,
  status      = 'active',
  description = excluded.description,
  archived_at = null;

-- 7. Unique partial index on active-only rates
drop index if exists idx_tax_rates_org_code_active;
create unique index idx_tax_rates_org_code_active on tax_rates (organization_id, code) where is_active = true;

-- 8. RLS policies (idempotent)
alter table tax_rates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_select') then
    create policy tax_rates_select on tax_rates
      for select using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_insert') then
    create policy tax_rates_insert on tax_rates
      for insert with check (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_update') then
    create policy tax_rates_update on tax_rates
      for update using (app_private.is_org_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'tax_rates_delete') then
    create policy tax_rates_delete on tax_rates
      for delete using (app_private.is_org_member(organization_id));
  end if;
end $$;

notify pgrst, 'reload schema';
