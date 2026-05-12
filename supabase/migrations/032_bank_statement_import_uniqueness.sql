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
