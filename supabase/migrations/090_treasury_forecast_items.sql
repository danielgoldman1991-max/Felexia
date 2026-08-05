-- Migration 090: treasury_forecast_items for manual cash-flow forecast lines.
-- Used for manual forecast entries / adjustments. Customer/supplier invoice
-- forecasts are computed at read time from their source tables (not duplicated).
-- Idempotent: safe to re-run.

create table if not exists public.treasury_forecast_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null default 'manual',
  direction text not null,
  source_type text null,
  source_id uuid null,
  label text not null,
  description text null,
  forecast_date date not null,
  amount numeric(14,2) not null default 0,
  probability numeric(5,2) not null default 100,
  weighted_amount numeric(14,2) not null default 0,
  status text not null default 'planned',
  category text null,
  treasury_account_id uuid null references public.treasury_accounts(id) on delete set null,
  is_manual boolean not null default true,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

alter table public.treasury_forecast_items
  add constraint treasury_forecast_items_direction_check
  check (direction in ('inflow', 'outflow'));

alter table public.treasury_forecast_items
  add constraint treasury_forecast_items_item_type_check
  check (item_type in ('customer_invoice', 'supplier_invoice', 'manual', 'scheduled_payment', 'payroll', 'tax', 'other'));

alter table public.treasury_forecast_items
  add constraint treasury_forecast_items_status_check
  check (status in ('planned', 'confirmed', 'realized', 'cancelled', 'ignored'));

alter table public.treasury_forecast_items
  add constraint treasury_forecast_items_amount_check
  check (amount >= 0);

alter table public.treasury_forecast_items
  add constraint treasury_forecast_items_probability_check
  check (probability >= 0 and probability <= 100);

create index if not exists idx_treasury_forecast_items_org ON public.treasury_forecast_items(organization_id);
create index if not exists idx_treasury_forecast_items_date ON public.treasury_forecast_items(forecast_date);
create index if not exists idx_treasury_forecast_items_direction ON public.treasury_forecast_items(direction);
create index if not exists idx_treasury_forecast_items_status ON public.treasury_forecast_items(status);
create index if not exists idx_treasury_forecast_items_source ON public.treasury_forecast_items(source_type, source_id);
create index if not exists idx_treasury_forecast_items_archived ON public.treasury_forecast_items(archived_at) where archived_at is null;

-- RLS
alter table public.treasury_forecast_items enable row level security;

-- Select for active members
drop policy if exists treasury_forecast_items_select on public.treasury_forecast_items;
create policy treasury_forecast_items_select on public.treasury_forecast_items
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = treasury_forecast_items.organization_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
    )
  );

-- Insert for owner/admin/accountant
drop policy if exists treasury_forecast_items_insert on public.treasury_forecast_items;
create policy treasury_forecast_items_insert on public.treasury_forecast_items
  for insert with check (
    exists (
      select 1 from public.organization_members m
      join public.roles r on r.id = m.role_id
      where m.organization_id = treasury_forecast_items.organization_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
        and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
    )
  );

-- Update for owner/admin/accountant (no direct delete policy on purpose)
drop policy if exists treasury_forecast_items_update on public.treasury_forecast_items;
create policy treasury_forecast_items_update on public.treasury_forecast_items
  for update using (
    exists (
      select 1 from public.organization_members m
      join public.roles r on r.id = m.role_id
      where m.organization_id = treasury_forecast_items.organization_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
        and lower(coalesce(r.name, '')) in ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
    )
  );

drop trigger if exists treasury_forecast_items_set_updated_at on public.treasury_forecast_items;
create trigger treasury_forecast_items_set_updated_at
  before update on public.treasury_forecast_items
  for each row execute function public.set_updated_at();
