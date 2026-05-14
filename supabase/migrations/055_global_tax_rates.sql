-- Migration 055: Global system tax rates (organization-agnostic)

-- 1. Add is_system column
alter table tax_rates add column if not exists is_system boolean not null default false;

-- 2. Create 6 global system tax rates (organization_id = null, is_system = true)
insert into tax_rates (organization_id, name, label, rate, code, is_default, is_active, is_system, sort_order, status, description)
values
  (null, '0 %', '0 %', 0, 'VAT_0', false, true, true, 1, 'active', 'TVA 0 %'),
  (null, '7 %', '7 %', 7, 'VAT_7', false, true, true, 2, 'active', 'TVA 7 %'),
  (null, '10 %', '10 %', 10, 'VAT_10', false, true, true, 3, 'active', 'TVA 10 %'),
  (null, '14 %', '14 %', 14, 'VAT_14', false, true, true, 4, 'active', 'TVA 14 %'),
  (null, '20 %', '20 %', 20, 'VAT_20', true, true, true, 5, 'active', 'TVA 20 %'),
  (null, 'Exonéré', 'Exonéré', 0, 'VAT_EXEMPT', false, true, true, 6, 'active', 'Exonéré de TVA')
on conflict do nothing;

-- 3. Archive old organization-specific tax rates (but keep them for existing document references)
update tax_rates
set archived_at = now(), is_active = false, is_system = false
where organization_id is not null and is_system = false;

-- 4. RLS policies: allow SELECT for authenticated, block INSERT/UPDATE/DELETE for all
alter table tax_rates enable row level security;

drop policy if exists tax_rates_select on tax_rates;
drop policy if exists tax_rates_insert on tax_rates;
drop policy if exists tax_rates_update on tax_rates;
drop policy if exists tax_rates_delete on tax_rates;

create policy tax_rates_select on tax_rates
  for select using (true);

create policy tax_rates_insert on tax_rates
  for insert with check (false);

create policy tax_rates_update on tax_rates
  for update using (false);

create policy tax_rates_delete on tax_rates
  for delete using (false);

notify pgrst, 'reload schema';