-- 116: variables de paie et soldes de congés.
-- Apply after 115 and before 117. Do not reuse this number.
-- Additive. The base-only RPC and the preparatory trigger of migration 106
-- stay in place. Existing payslips are not rewritten.
--
-- Rollback:
-- drop trigger if exists aa_pro_member_write on public.hr_leave_balances;
-- drop trigger if exists aa_pro_member_write on public.hr_payslip_variables;
-- drop table if exists public.hr_leave_balances;
-- drop table if exists public.hr_payslip_variables;

create or replace function app_private.guard_pro_member_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
begin
  perform app_private.assert_pro_write_access(org, true);
  if auth.uid() is not null and app_private.is_read_only_org_member(org) then
    raise exception 'READ_ONLY' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.guard_pro_member_write() from public, anon, authenticated;

create table if not exists public.hr_payslip_variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.hr_payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  bonuses numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  indemnities numeric(14,2) not null default 0,
  absence_deduction numeric(14,2) not null default 0,
  advance_deduction numeric(14,2) not null default 0,
  dependents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);

create table if not exists public.hr_leave_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_year integer not null,
  acquired_days numeric(8,2) not null default 0,
  taken_days numeric(8,2) not null default 0,
  remaining_days numeric(8,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_year)
);

create index if not exists hr_payslip_variables_org_idx on public.hr_payslip_variables (organization_id, payroll_period_id);
create index if not exists hr_leave_balances_org_idx on public.hr_leave_balances (organization_id, leave_year);

alter table public.hr_payslip_variables enable row level security;
alter table public.hr_leave_balances enable row level security;

drop policy if exists hr_payslip_variables_select on public.hr_payslip_variables;
create policy hr_payslip_variables_select on public.hr_payslip_variables
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_payslip_variables_write on public.hr_payslip_variables;
create policy hr_payslip_variables_write on public.hr_payslip_variables
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

drop policy if exists hr_leave_balances_select on public.hr_leave_balances;
create policy hr_leave_balances_select on public.hr_leave_balances
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_leave_balances_write on public.hr_leave_balances;
create policy hr_leave_balances_write on public.hr_leave_balances
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

grant select, insert, update, delete on public.hr_payslip_variables, public.hr_leave_balances to authenticated;
revoke all on public.hr_payslip_variables, public.hr_leave_balances from anon;

drop trigger if exists aa_pro_member_write on public.hr_payslip_variables;
create trigger aa_pro_member_write before insert or update or delete on public.hr_payslip_variables
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.hr_leave_balances;
create trigger aa_pro_member_write before insert or update or delete on public.hr_leave_balances
  for each row execute function app_private.guard_pro_member_write();
