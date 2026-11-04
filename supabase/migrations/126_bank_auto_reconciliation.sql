-- 126: rapprochement bancaire automatique (mapping, règles, apprentissages, journal).
-- Apply after 125. Additive. Relevés, lignes et rapprochements déjà saisis restent inchangés.
-- Rollback: supabase/rollbacks/126_bank_auto_reconciliation_rollback.sql

create table if not exists public.bank_import_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid not null references public.treasury_accounts(id) on delete cascade,
  bank_code text,
  columns jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, treasury_account_id)
);

create table if not exists public.bank_match_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid references public.treasury_accounts(id) on delete cascade,
  label_contains text not null,
  direction text,
  category text not null,
  third_party_id uuid references public.third_parties(id) on delete set null,
  account_code text,
  auto_apply boolean not null default false,
  active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  constraint bank_match_rules_direction_check check (direction is null or direction in ('in', 'out')),
  constraint bank_match_rules_category_check check (category in ('customer', 'supplier', 'fee', 'commission', 'vat_fee', 'agio', 'ignore')),
  constraint bank_match_rules_label_check check (char_length(btrim(label_contains)) between 2 and 80)
);

create table if not exists public.bank_match_learnings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label_key text not null,
  direction text not null,
  third_party_id uuid references public.third_parties(id) on delete set null,
  category text,
  confirmations integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint bank_match_learnings_direction_check check (direction in ('in', 'out')),
  constraint bank_match_learnings_confirmations_check check (confirmations >= 1),
  unique (organization_id, label_key, direction)
);

create table if not exists public.bank_reconciliation_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  auto_threshold integer not null default 92,
  suggest_threshold integer not null default 70,
  date_window_days integer not null default 5,
  auto_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint bank_reconciliation_settings_thresholds_check check (
    auto_threshold between 80 and 100
    and suggest_threshold between 40 and 90
    and auto_threshold > suggest_threshold
    and date_window_days between 0 and 15
  )
);

create table if not exists public.bank_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  treasury_account_id uuid references public.treasury_accounts(id) on delete set null,
  statement_line_id uuid references public.bank_statement_lines(id) on delete cascade,
  action text not null,
  score integer,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint bank_reconciliation_events_action_check check (action in (
    'auto_confirmed', 'suggestion_confirmed', 'manual', 'undone', 'fee_booked', 'skipped'
  ))
);

create table if not exists public.bank_reconciliation_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  statement_line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  kind text not null,
  status text not null default 'confirmed',
  score integer,
  reason text,
  created_at timestamptz not null default now(),
  constraint bank_reconciliation_groups_kind_check check (kind in ('single', 'grouped', 'partial', 'fee')),
  constraint bank_reconciliation_groups_status_check check (status in ('confirmed', 'cancelled'))
);

create table if not exists public.bank_reconciliation_group_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.bank_reconciliation_groups(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  amount numeric(14,2) not null,
  constraint bank_reconciliation_group_items_type_check check (target_type in ('transaction', 'customer_invoice', 'supplier_invoice', 'customer_payment', 'supplier_payment', 'fee')),
  constraint bank_reconciliation_group_items_amount_check check (amount > 0)
);

create index if not exists bank_match_rules_org_idx on public.bank_match_rules (organization_id, active);
create index if not exists bank_reconciliation_events_org_idx on public.bank_reconciliation_events (organization_id, created_at desc);
create index if not exists bank_reconciliation_groups_line_idx on public.bank_reconciliation_groups (organization_id, statement_line_id);

comment on table public.bank_import_mappings is 'Correspondance de colonnes mémorisée par compte bancaire.';
comment on table public.bank_match_rules is 'Règles de libellé du rapprochement automatique.';
comment on table public.bank_match_learnings is 'Libellés confirmés manuellement, réutilisés comme indice.';
comment on table public.bank_reconciliation_events is 'Journal des rapprochements automatiques, des validations et des annulations.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bank_import_mappings', 'bank_match_rules', 'bank_match_learnings',
    'bank_reconciliation_settings', 'bank_reconciliation_events',
    'bank_reconciliation_groups', 'bank_reconciliation_group_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app_private.has_active_org_membership(organization_id))',
      table_name || '_select', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id)) with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))',
      table_name || '_write', table_name
    );
    execute format('drop policy if exists pro_read_guard_110 on public.%I', table_name);
    execute format(
      'create policy pro_read_guard_110 on public.%I as restrictive for select to authenticated using (app_private.can_read_pro_erp_110(organization_id))',
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('drop trigger if exists aa_pro_member_write on public.%I', table_name);
    execute format(
      'create trigger aa_pro_member_write before insert or update or delete on public.%I for each row execute function app_private.guard_pro_member_write()',
      table_name
    );
  end loop;
end $$;
