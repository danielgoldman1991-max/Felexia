-- Migration 038: Add missing columns for chart of accounts management
-- Adds parent_account_id, is_auxiliary, notes, archived_at to accounting_accounts

alter table public.accounting_accounts add column if not exists parent_account_id uuid null references public.accounting_accounts(id) on delete set null;
alter table public.accounting_accounts add column if not exists is_auxiliary boolean not null default false;
alter table public.accounting_accounts add column if not exists notes text null;
alter table public.accounting_accounts add column if not exists archived_at timestamptz null;

create index if not exists accounting_accounts_parent_account_id_idx on public.accounting_accounts(parent_account_id);
create index if not exists accounting_accounts_is_auxiliary_idx on public.accounting_accounts(is_auxiliary);
create index if not exists accounting_accounts_archived_at_idx on public.accounting_accounts(archived_at);
