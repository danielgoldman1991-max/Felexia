-- Rollback of 128_schema_drift_repair.
-- Only drops objects that 128 created. Run the table drops only if the tables
-- are still empty (or after exporting them): document_settings / user_preferences
-- hold user data once settings have been saved.
-- NOT covered by 128 on purpose: idx_tax_rates_org_code_active (054, superseded in
-- production) and idx_units_org_lower_symbol (063, 66 duplicate groups exist).

drop index if exists public.idx_product_categories_org_lower_name;
drop index if exists public.sales_documents_stock_updated_at_idx;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
drop trigger if exists document_settings_set_updated_at on public.document_settings;
drop table if exists public.user_preferences;
drop table if exists public.document_settings;
alter table public.organizations drop column if exists country;

drop index if exists public.bank_statement_lines_line_fingerprint_unique;
drop index if exists public.bank_statement_imports_statement_fingerprint_unique;
drop index if exists public.bank_statement_imports_file_hash_unique;
drop index if exists public.bank_statement_imports_org_import_code_unique;
drop index if exists public.bank_statement_lines_line_fingerprint_idx;
drop index if exists public.bank_statement_lines_line_hash_idx;
drop index if exists public.bank_statement_imports_statement_fingerprint_idx;
drop index if exists public.bank_statement_imports_file_hash_idx;
drop index if exists public.bank_statement_imports_organization_import_code_idx;
-- Columns are dropped last; skip these if bank imports have been made since 128
-- (they hold the dedup fingerprints).
alter table public.bank_statement_lines drop column if exists line_fingerprint, drop column if exists line_hash;
alter table public.bank_statement_imports drop column if exists statement_fingerprint, drop column if exists file_hash, drop column if exists import_code;
