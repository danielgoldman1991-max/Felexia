-- 123: historique des congés, solde de tout compte, listes d'arrivée et de départ.
-- Apply after 122. Additive. Existing leave requests, contracts and employees are not rewritten.
-- Rollback: supabase/rollbacks/123_hr_leave_settlements_and_checks_rollback.sql

create table if not exists public.hr_leave_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  leave_request_id uuid not null references public.hr_leave_requests(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject', 'cancel')),
  previous_status text not null,
  next_status text not null,
  days_count numeric(8,2) not null check (days_count > 0),
  balance_delta numeric(8,2) not null default 0,
  comment text null,
  decided_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_final_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  contract_id uuid null references public.hr_contracts(id) on delete set null,
  settlement_number text not null,
  exit_date date not null,
  reason text not null check (reason in ('demission', 'licenciement', 'fin_cdd', 'faute_grave', 'retraite', 'autre')),
  years_of_service numeric(8,2) not null default 0,
  monthly_salary numeric(14,2) not null default 0 check (monthly_salary >= 0),
  leave_days numeric(8,2) not null default 0 check (leave_days >= 0),
  leave_indemnity numeric(14,2) not null default 0 check (leave_indemnity >= 0),
  notice_days numeric(8,2) not null default 0 check (notice_days >= 0),
  notice_indemnity numeric(14,2) not null default 0 check (notice_indemnity >= 0),
  dismissal_indemnity numeric(14,2) not null default 0 check (dismissal_indemnity >= 0),
  last_net numeric(14,2) not null default 0 check (last_net >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text null,
  official_claim boolean not null default false check (official_claim = false),
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique (organization_id, settlement_number)
);

create table if not exists public.hr_employee_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  kind text not null check (kind in ('onboarding', 'offboarding')),
  item_key text not null,
  done boolean not null default false,
  note text null,
  updated_at timestamptz not null default now(),
  unique (employee_id, kind, item_key)
);

create index if not exists hr_leave_decisions_org_idx on public.hr_leave_decisions (organization_id, leave_request_id, created_at desc);
create index if not exists hr_final_settlements_org_idx on public.hr_final_settlements (organization_id, employee_id);
create index if not exists hr_employee_checks_org_idx on public.hr_employee_checks (organization_id, kind);

alter table public.hr_leave_decisions enable row level security;
alter table public.hr_final_settlements enable row level security;
alter table public.hr_employee_checks enable row level security;

drop policy if exists hr_leave_decisions_select on public.hr_leave_decisions;
create policy hr_leave_decisions_select on public.hr_leave_decisions
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_leave_decisions_write on public.hr_leave_decisions;
create policy hr_leave_decisions_write on public.hr_leave_decisions
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

drop policy if exists hr_final_settlements_select on public.hr_final_settlements;
create policy hr_final_settlements_select on public.hr_final_settlements
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_final_settlements_write on public.hr_final_settlements;
create policy hr_final_settlements_write on public.hr_final_settlements
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

drop policy if exists hr_employee_checks_select on public.hr_employee_checks;
create policy hr_employee_checks_select on public.hr_employee_checks
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_employee_checks_write on public.hr_employee_checks;
create policy hr_employee_checks_write on public.hr_employee_checks
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));

drop policy if exists pro_read_guard_110 on public.hr_leave_decisions;
create policy pro_read_guard_110 on public.hr_leave_decisions as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));
drop policy if exists pro_read_guard_110 on public.hr_final_settlements;
create policy pro_read_guard_110 on public.hr_final_settlements as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));
drop policy if exists pro_read_guard_110 on public.hr_employee_checks;
create policy pro_read_guard_110 on public.hr_employee_checks as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));

grant select, insert, update, delete on public.hr_leave_decisions, public.hr_final_settlements, public.hr_employee_checks to authenticated;
revoke all on public.hr_leave_decisions, public.hr_final_settlements, public.hr_employee_checks from anon;

drop trigger if exists aa_pro_member_write on public.hr_leave_decisions;
create trigger aa_pro_member_write before insert or update or delete on public.hr_leave_decisions
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.hr_final_settlements;
create trigger aa_pro_member_write before insert or update or delete on public.hr_final_settlements
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.hr_employee_checks;
create trigger aa_pro_member_write before insert or update or delete on public.hr_employee_checks
  for each row execute function app_private.guard_pro_member_write();
