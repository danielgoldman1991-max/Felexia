-- 124: paramètres de préparation fiscale et sociale.
-- Apply after 123. Additive. No password, token or filing receipt is stored.
-- Rollback: supabase/rollbacks/124_organization_fiscal_settings_rollback.sql

create table if not exists public.organization_fiscal_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  cnss_affiliation text null,
  vat_frequency text not null default 'monthly' check (vat_frequency in ('monthly', 'quarterly')),
  is_rate_percent numeric(6,3) null check (is_rate_percent is null or (is_rate_percent >= 0 and is_rate_percent <= 40)),
  activity_code text null,
  filing_note text null,
  updated_at timestamptz not null default now()
);

alter table public.organization_fiscal_settings enable row level security;

drop policy if exists organization_fiscal_settings_select on public.organization_fiscal_settings;
create policy organization_fiscal_settings_select on public.organization_fiscal_settings
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists organization_fiscal_settings_write on public.organization_fiscal_settings;
create policy organization_fiscal_settings_write on public.organization_fiscal_settings
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

drop policy if exists pro_read_guard_110 on public.organization_fiscal_settings;
create policy pro_read_guard_110 on public.organization_fiscal_settings as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));

grant select, insert, update, delete on public.organization_fiscal_settings to authenticated;
revoke all on public.organization_fiscal_settings from anon;

drop trigger if exists aa_pro_member_write on public.organization_fiscal_settings;
create trigger aa_pro_member_write before insert or update or delete on public.organization_fiscal_settings
  for each row execute function app_private.guard_pro_member_write();
