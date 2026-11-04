-- 137: HR fields, work schedules, absence range, advance deduction month, leave overlap.
-- Apply after 136. Additive. Existing employees, leaves, absences and advances are kept.
-- Rollback: supabase/rollbacks/137_hr_operations_rollback.sql

do $$ begin
  if to_regclass('public.hr_employees') is not null then
    alter table public.hr_employees add column if not exists cimr_enabled boolean not null default false;
    alter table public.hr_employees add column if not exists cimr_rate numeric(8,4);
    alter table public.hr_employees add column if not exists mutuelle_label text;
    alter table public.hr_employees add column if not exists mutuelle_amount numeric(14,2) not null default 0;
    alter table public.hr_employees add column if not exists weekly_hours numeric(8,2) not null default 44;
  end if;
  if to_regclass('public.hr_absences') is not null then
    alter table public.hr_absences add column if not exists end_date date;
    alter table public.hr_absences add column if not exists attachment_path text;
    alter table public.hr_absences add column if not exists attachment_name text;
  end if;
  if to_regclass('public.hr_advances') is not null then
    alter table public.hr_advances add column if not exists deduction_month integer;
    alter table public.hr_advances add column if not exists deduction_year integer;
  end if;
  if to_regclass('public.hr_expense_reports') is not null then
    alter table public.hr_expense_reports add column if not exists tax_rate numeric(8,2);
  end if;
end $$;

create table if not exists public.hr_work_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  weekly_hours numeric(8,2) not null default 44,
  work_days text not null default 'lundi-vendredi',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.hr_work_schedules enable row level security;

drop policy if exists hr_work_schedules_select on public.hr_work_schedules;
create policy hr_work_schedules_select on public.hr_work_schedules
  for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists hr_work_schedules_write on public.hr_work_schedules;
create policy hr_work_schedules_write on public.hr_work_schedules
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id) and not app_private.is_operator_org_member(organization_id));
drop policy if exists pro_read_guard_110 on public.hr_work_schedules;
create policy pro_read_guard_110 on public.hr_work_schedules as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));
grant select, insert, update, delete on public.hr_work_schedules to authenticated;
revoke all on public.hr_work_schedules from anon;
drop trigger if exists aa_pro_member_write on public.hr_work_schedules;
create trigger aa_pro_member_write before insert or update or delete on public.hr_work_schedules
  for each row execute function app_private.guard_pro_member_write();

create or replace function app_private.guard_hr_leave_overlap()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status not in ('pending', 'approved') then
    return new;
  end if;
  if new.end_date < new.start_date then
    raise exception 'HR_LEAVE_OVERLAP' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.hr_leave_requests other
    where other.organization_id = new.organization_id
      and other.employee_id = new.employee_id
      and other.id is distinct from new.id
      and other.status in ('pending', 'approved')
      and other.start_date <= new.end_date
      and other.end_date >= new.start_date
  ) then
    raise exception 'HR_LEAVE_OVERLAP' using errcode = '23514';
  end if;
  return new;
end; $$;

revoke all on function app_private.guard_hr_leave_overlap() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.hr_leave_requests') is not null then
    drop trigger if exists hr_leave_overlap_137 on public.hr_leave_requests;
    create trigger hr_leave_overlap_137
      before insert or update of start_date, end_date, status, employee_id
      on public.hr_leave_requests
      for each row execute function app_private.guard_hr_leave_overlap();
  end if;
end $$;
