-- 127: relances clients (file, exclusions, promesses, journal d'envoi).
-- Apply after 126. Additive. Les relances et règles déjà saisies restent inchangées.
-- L'envoi automatique reste désactivé tant que l'entreprise ne l'active pas.
-- Rollback: supabase/rollbacks/127_customer_collection_rollback.sql

create table if not exists public.customer_collection_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  auto_send boolean not null default false,
  include_arabic boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_collection_exclusions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.third_parties(id) on delete cascade,
  reason text not null default 'pause',
  paused_until date,
  note text,
  created_at timestamptz not null default now(),
  constraint customer_collection_exclusions_reason_check check (reason in ('dispute', 'pause')),
  unique (organization_id, customer_id)
);

create table if not exists public.customer_payment_promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.third_parties(id) on delete cascade,
  invoice_id uuid references public.customer_invoices(id) on delete cascade,
  promised_on date not null,
  amount numeric(14,2) not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint customer_payment_promises_amount_check check (amount > 0),
  constraint customer_payment_promises_status_check check (status in ('open', 'kept', 'broken'))
);

create table if not exists public.customer_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_id uuid references public.customer_reminders(id) on delete set null,
  invoice_id uuid references public.customer_invoices(id) on delete set null,
  customer_id uuid not null references public.third_parties(id) on delete cascade,
  channel text not null,
  status text not null default 'journal',
  recipient text,
  subject text,
  body text,
  error text,
  created_at timestamptz not null default now(),
  constraint customer_reminder_dispatches_channel_check check (channel in ('email', 'whatsapp', 'letter', 'phone')),
  constraint customer_reminder_dispatches_status_check check (status in ('queued', 'sent', 'journal', 'failed', 'skipped'))
);

create index if not exists customer_payment_promises_org_idx on public.customer_payment_promises (organization_id, status, promised_on);
create index if not exists customer_reminder_dispatches_invoice_idx on public.customer_reminder_dispatches (organization_id, invoice_id, created_at desc);

comment on table public.customer_collection_settings is 'Envoi automatique des relances, désactivé par défaut.';
comment on table public.customer_reminder_dispatches is 'Journal des relances. Sans expéditeur configuré, le statut reste journal.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customer_collection_settings', 'customer_collection_exclusions',
    'customer_payment_promises', 'customer_reminder_dispatches'
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
