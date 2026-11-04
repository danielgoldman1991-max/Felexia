-- Migration 128: schema drift repair (additive, idempotent).
--
-- Migrations 032 and 040 were present in the repository but never applied to
-- production, which broke bank statement import (/tresorerie/releves/import)
-- and /parametres/documents + /parametres/preferences. Found by diffing every
-- CREATE TABLE / ADD COLUMN / CREATE INDEX of supabase/migrations against the
-- production information_schema.
--
-- Rules: only "if not exists" objects, no data is read, moved or deleted.
-- Deliberately NOT repaired (see supabase/rollbacks/128_schema_drift_repair_rollback.sql
-- header and docs): idx_tax_rates_org_code_active (054: production later moved
-- to tax_rates_org_code_key + tax_rates_global_code_active_unique) and
-- idx_units_org_lower_symbol (063: 66 case-insensitive duplicate symbol groups
-- already exist in production, so the unique index cannot be built).

-- ---------------------------------------------------------------------------
-- 1. From 032: bank statement import fingerprints (all nullable)
-- ---------------------------------------------------------------------------
alter table public.bank_statement_imports
  add column if not exists import_code text null,
  add column if not exists file_hash text null,
  add column if not exists statement_fingerprint text null;

alter table public.bank_statement_lines
  add column if not exists line_hash text null,
  add column if not exists line_fingerprint text null;

create index if not exists bank_statement_imports_organization_import_code_idx
  on public.bank_statement_imports (organization_id, import_code);
create index if not exists bank_statement_imports_file_hash_idx
  on public.bank_statement_imports (organization_id, treasury_account_id, file_hash);
create index if not exists bank_statement_imports_statement_fingerprint_idx
  on public.bank_statement_imports (organization_id, treasury_account_id, statement_fingerprint);
create index if not exists bank_statement_lines_line_hash_idx
  on public.bank_statement_lines (organization_id, treasury_account_id, line_hash);
create index if not exists bank_statement_lines_line_fingerprint_idx
  on public.bank_statement_lines (organization_id, treasury_account_id, line_fingerprint);

-- The new columns are NULL for every existing row, so these partial unique
-- indexes cannot conflict with existing data.
create unique index if not exists bank_statement_imports_org_import_code_unique
  on public.bank_statement_imports (organization_id, import_code)
  where import_code is not null;
create unique index if not exists bank_statement_imports_file_hash_unique
  on public.bank_statement_imports (organization_id, treasury_account_id, file_hash)
  where file_hash is not null and archived_at is null;
create unique index if not exists bank_statement_imports_statement_fingerprint_unique
  on public.bank_statement_imports (organization_id, treasury_account_id, statement_fingerprint)
  where statement_fingerprint is not null and archived_at is null;
create unique index if not exists bank_statement_lines_line_fingerprint_unique
  on public.bank_statement_lines (organization_id, treasury_account_id, line_fingerprint)
  where line_fingerprint is not null;

-- ---------------------------------------------------------------------------
-- 2. From 040: document_settings and user_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.document_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_color text default '#111827',
  logo_url text,
  invoice_terms text,
  legal_mentions text,
  footer_note text,
  quote_prefix text default 'DEV',
  invoice_prefix text default 'FAC',
  credit_note_prefix text default 'AV',
  delivery_note_prefix text default 'BL',
  payment_prefix text default 'REG',
  numbering_format text default '{PREFIX}-{YEAR}-{NUMBER}',
  next_quote_number integer default 1,
  next_invoice_number integer default 1,
  next_credit_note_number integer default 1,
  next_delivery_note_number integer default 1,
  show_ice boolean default true,
  show_rc boolean default true,
  show_stamp_signature boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  language text default 'fr',
  currency text default 'MAD',
  date_format text default 'DD/MM/YYYY',
  timezone text default 'Africa/Casablanca',
  theme text default 'system',
  rows_per_page integer default 20,
  compact_mode boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- organizations.country was added by 040 too. Kept nullable without the 040
-- default 'MA' so existing screens keep falling back to company_settings.country
-- ("Maroc") instead of suddenly displaying "MA".
alter table public.organizations add column if not exists country text;

alter table public.document_settings enable row level security;
alter table public.user_preferences enable row level security;

revoke all on public.document_settings from anon;
revoke all on public.user_preferences from anon;
grant select, insert, update, delete on public.document_settings to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

-- Original 040 policies.
drop policy if exists document_settings_org_member_select on public.document_settings;
create policy document_settings_org_member_select on public.document_settings
  for select using (app_private.is_org_member(organization_id));

drop policy if exists document_settings_org_admin_insert on public.document_settings;
create policy document_settings_org_admin_insert on public.document_settings
  for insert with check (app_private.is_org_member(organization_id));

drop policy if exists document_settings_org_admin_update on public.document_settings;
create policy document_settings_org_admin_update on public.document_settings
  for update using (app_private.is_org_member(organization_id));

drop policy if exists user_preferences_self on public.user_preferences;
create policy user_preferences_self on public.user_preferences
  for all using (user_id = auth.uid());

-- Restrictive guards identical to the ones company_settings carries in
-- production (active membership v3, read-only v4, operator v5), so a
-- read-only or operator member cannot write document settings.
drop policy if exists active_membership_guard_v3 on public.document_settings;
create policy active_membership_guard_v3 on public.document_settings
  as restrictive for all
  using (app_private.has_active_org_membership(organization_id))
  with check (app_private.has_active_org_membership(organization_id));

drop policy if exists readonly_finance_insert_guard_v4 on public.document_settings;
create policy readonly_finance_insert_guard_v4 on public.document_settings
  as restrictive for insert
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists readonly_finance_update_guard_v4 on public.document_settings;
create policy readonly_finance_update_guard_v4 on public.document_settings
  as restrictive for update
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists readonly_finance_delete_guard_v4 on public.document_settings;
create policy readonly_finance_delete_guard_v4 on public.document_settings
  as restrictive for delete
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists operator_insert_guard_v5 on public.document_settings;
create policy operator_insert_guard_v5 on public.document_settings
  as restrictive for insert
  with check (not app_private.is_operator_org_member(organization_id));

drop policy if exists operator_update_guard_v5 on public.document_settings;
create policy operator_update_guard_v5 on public.document_settings
  as restrictive for update
  using (not app_private.is_operator_org_member(organization_id))
  with check (not app_private.is_operator_org_member(organization_id));

drop policy if exists operator_delete_guard_v5 on public.document_settings;
create policy operator_delete_guard_v5 on public.document_settings
  as restrictive for delete
  using (not app_private.is_operator_org_member(organization_id));

drop trigger if exists document_settings_set_updated_at on public.document_settings;
create trigger document_settings_set_updated_at before update on public.document_settings
  for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

create index if not exists document_settings_organization_id_idx on public.document_settings (organization_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences (user_id);
create index if not exists user_preferences_organization_id_idx on public.user_preferences (organization_id);

-- ---------------------------------------------------------------------------
-- 3. From 006: plain index on an existing column
-- ---------------------------------------------------------------------------
create index if not exists sales_documents_stock_updated_at_idx
  on public.sales_documents (stock_updated_at);

-- ---------------------------------------------------------------------------
-- 4. From 063: case-insensitive uniqueness for product categories, only when
--    no duplicate exists (checked at apply time; otherwise skipped with a notice).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.product_categories
    group by organization_id, lower(name) having count(*) > 1
  ) then
    raise notice 'idx_product_categories_org_lower_name skipped: duplicates exist';
  else
    create unique index if not exists idx_product_categories_org_lower_name
      on public.product_categories (organization_id, lower(name));
  end if;
end $$;
