-- Felexia - Treasury module V1.
-- Operational cash/bank tracking, statement imports, and reconciliation.

create table if not exists public.treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text null,
  account_type text not null default 'bank',
  bank_name text null,
  agency_name text null,
  rib text null,
  iban text null,
  swift text null,
  account_number text null,
  currency text not null default 'MAD',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  opening_balance_date date null,
  is_default boolean not null default false,
  status text not null default 'active',
  notes text null,
  created_by uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz null,
  constraint treasury_accounts_type_check check (account_type in ('bank','cash','mobile_money','payment_gateway','credit_card','other')),
  constraint treasury_accounts_status_check check (status in ('active','inactive','archived'))
);

create unique index if not exists treasury_accounts_org_code_not_null_unique on public.treasury_accounts (organization_id, code) where code is not null;
create index if not exists treasury_accounts_organization_id_idx on public.treasury_accounts (organization_id);
create index if not exists treasury_accounts_account_type_idx on public.treasury_accounts (account_type);
create index if not exists treasury_accounts_status_idx on public.treasury_accounts (status);
create index if not exists treasury_accounts_is_default_idx on public.treasury_accounts (is_default);
create index if not exists treasury_accounts_archived_at_idx on public.treasury_accounts (archived_at);

create table if not exists public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id),
  transaction_type text not null,
  direction text not null,
  amount numeric(14,2) not null,
  currency text not null default 'MAD',
  transaction_date date not null default current_date,
  value_date date null,
  label text not null,
  reference text null,
  description text null,
  third_party_id uuid null references public.third_parties(id),
  customer_payment_id uuid null references public.customer_payments(id),
  supplier_payment_id uuid null references public.supplier_payments(id),
  customer_invoice_id uuid null references public.customer_invoices(id),
  supplier_invoice_id uuid null references public.supplier_invoices(id),
  reconciliation_status text not null default 'unreconciled',
  reconciled_at timestamptz null,
  reconciled_by uuid null,
  created_by uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz null,
  constraint treasury_transactions_amount_check check (amount > 0),
  constraint treasury_transactions_direction_check check (direction in ('in','out')),
  constraint treasury_transactions_type_check check (transaction_type in ('customer_payment','supplier_payment','manual_in','manual_out','bank_fee','transfer_in','transfer_out','opening_balance','adjustment','other')),
  constraint treasury_transactions_reconciliation_status_check check (reconciliation_status in ('unreconciled','partially_reconciled','reconciled','ignored'))
);

create unique index if not exists treasury_transactions_customer_payment_unique on public.treasury_transactions (organization_id, customer_payment_id) where customer_payment_id is not null and archived_at is null;
create unique index if not exists treasury_transactions_supplier_payment_unique on public.treasury_transactions (organization_id, supplier_payment_id) where supplier_payment_id is not null and archived_at is null;
create index if not exists treasury_transactions_organization_id_idx on public.treasury_transactions (organization_id);
create index if not exists treasury_transactions_account_id_idx on public.treasury_transactions (treasury_account_id);
create index if not exists treasury_transactions_transaction_date_idx on public.treasury_transactions (transaction_date);
create index if not exists treasury_transactions_value_date_idx on public.treasury_transactions (value_date);
create index if not exists treasury_transactions_type_idx on public.treasury_transactions (transaction_type);
create index if not exists treasury_transactions_direction_idx on public.treasury_transactions (direction);
create index if not exists treasury_transactions_reconciliation_idx on public.treasury_transactions (reconciliation_status);
create index if not exists treasury_transactions_third_party_id_idx on public.treasury_transactions (third_party_id);
create index if not exists treasury_transactions_customer_payment_id_idx on public.treasury_transactions (customer_payment_id);
create index if not exists treasury_transactions_supplier_payment_id_idx on public.treasury_transactions (supplier_payment_id);
create index if not exists treasury_transactions_archived_at_idx on public.treasury_transactions (archived_at);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id),
  file_name text not null,
  file_type text null,
  period_start date null,
  period_end date null,
  imported_lines_count integer not null default 0,
  matched_lines_count integer not null default 0,
  unmatched_lines_count integer not null default 0,
  status text not null default 'imported',
  imported_by uuid null,
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  archived_at timestamptz null,
  constraint bank_statement_imports_status_check check (status in ('imported','partially_reconciled','reconciled','cancelled'))
);

create index if not exists bank_statement_imports_organization_id_idx on public.bank_statement_imports (organization_id);
create index if not exists bank_statement_imports_account_id_idx on public.bank_statement_imports (treasury_account_id);
create index if not exists bank_statement_imports_imported_at_idx on public.bank_statement_imports (imported_at);
create index if not exists bank_statement_imports_status_idx on public.bank_statement_imports (status);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id),
  operation_date date not null,
  value_date date null,
  label text not null,
  reference text null,
  debit_amount numeric(14,2) not null default 0,
  credit_amount numeric(14,2) not null default 0,
  amount numeric(14,2) not null,
  direction text not null,
  balance_after numeric(14,2) null,
  reconciliation_status text not null default 'unreconciled',
  matched_transaction_id uuid null references public.treasury_transactions(id),
  matched_at timestamptz null,
  matched_by uuid null,
  match_score numeric(5,2) null,
  match_reason text null,
  raw_data jsonb null,
  created_at timestamptz default now(),
  constraint bank_statement_lines_direction_check check (direction in ('in','out')),
  constraint bank_statement_lines_status_check check (reconciliation_status in ('unreconciled','suggested','reconciled','ignored')),
  constraint bank_statement_lines_amount_check check (amount > 0)
);

create index if not exists bank_statement_lines_organization_id_idx on public.bank_statement_lines (organization_id);
create index if not exists bank_statement_lines_account_id_idx on public.bank_statement_lines (treasury_account_id);
create index if not exists bank_statement_lines_import_id_idx on public.bank_statement_lines (import_id);
create index if not exists bank_statement_lines_operation_date_idx on public.bank_statement_lines (operation_date);
create index if not exists bank_statement_lines_value_date_idx on public.bank_statement_lines (value_date);
create index if not exists bank_statement_lines_direction_idx on public.bank_statement_lines (direction);
create index if not exists bank_statement_lines_reconciliation_idx on public.bank_statement_lines (reconciliation_status);
create index if not exists bank_statement_lines_matched_transaction_id_idx on public.bank_statement_lines (matched_transaction_id);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id),
  statement_line_id uuid not null references public.bank_statement_lines(id),
  transaction_id uuid not null references public.treasury_transactions(id),
  amount numeric(14,2) not null,
  reconciliation_date date not null default current_date,
  status text not null default 'confirmed',
  notes text null,
  created_by uuid null,
  created_at timestamptz default now(),
  cancelled_at timestamptz null,
  constraint bank_reconciliations_amount_check check (amount > 0),
  constraint bank_reconciliations_status_check check (status in ('confirmed','cancelled'))
);

create unique index if not exists bank_reconciliations_statement_line_active_unique on public.bank_reconciliations (statement_line_id) where status = 'confirmed';
create unique index if not exists bank_reconciliations_transaction_active_unique on public.bank_reconciliations (transaction_id) where status = 'confirmed';
create index if not exists bank_reconciliations_organization_id_idx on public.bank_reconciliations (organization_id);
create index if not exists bank_reconciliations_account_id_idx on public.bank_reconciliations (treasury_account_id);
create index if not exists bank_reconciliations_statement_line_id_idx on public.bank_reconciliations (statement_line_id);
create index if not exists bank_reconciliations_transaction_id_idx on public.bank_reconciliations (transaction_id);
create index if not exists bank_reconciliations_status_idx on public.bank_reconciliations (status);

alter table public.treasury_accounts enable row level security;
alter table public.treasury_transactions enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliations enable row level security;

drop policy if exists treasury_accounts_org_member_all on public.treasury_accounts;
create policy treasury_accounts_org_member_all on public.treasury_accounts for all using (
  exists (select 1 from public.organization_members om where om.organization_id = treasury_accounts.organization_id and om.user_id = auth.uid())
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = treasury_accounts.organization_id and om.user_id = auth.uid())
);

drop policy if exists treasury_transactions_org_member_all on public.treasury_transactions;
create policy treasury_transactions_org_member_all on public.treasury_transactions for all using (
  exists (select 1 from public.organization_members om where om.organization_id = treasury_transactions.organization_id and om.user_id = auth.uid())
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = treasury_transactions.organization_id and om.user_id = auth.uid())
);

drop policy if exists bank_statement_imports_org_member_all on public.bank_statement_imports;
create policy bank_statement_imports_org_member_all on public.bank_statement_imports for all using (
  exists (select 1 from public.organization_members om where om.organization_id = bank_statement_imports.organization_id and om.user_id = auth.uid())
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = bank_statement_imports.organization_id and om.user_id = auth.uid())
);

drop policy if exists bank_statement_lines_org_member_all on public.bank_statement_lines;
create policy bank_statement_lines_org_member_all on public.bank_statement_lines for all using (
  exists (select 1 from public.organization_members om where om.organization_id = bank_statement_lines.organization_id and om.user_id = auth.uid())
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = bank_statement_lines.organization_id and om.user_id = auth.uid())
);

drop policy if exists bank_reconciliations_org_member_all on public.bank_reconciliations;
create policy bank_reconciliations_org_member_all on public.bank_reconciliations for all using (
  exists (select 1 from public.organization_members om where om.organization_id = bank_reconciliations.organization_id and om.user_id = auth.uid())
) with check (
  exists (select 1 from public.organization_members om where om.organization_id = bank_reconciliations.organization_id and om.user_id = auth.uid())
);
