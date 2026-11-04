-- Rollback 137. Drops the overlap trigger, work schedules, and columns added by this migration.
-- marital_status, dependents_count and cimr_number already existed and are kept.

drop trigger if exists hr_leave_overlap_137 on public.hr_leave_requests;
drop function if exists app_private.guard_hr_leave_overlap();
drop trigger if exists aa_pro_member_write on public.hr_work_schedules;
drop table if exists public.hr_work_schedules;

alter table public.hr_employees drop column if exists weekly_hours;
alter table public.hr_employees drop column if exists mutuelle_amount;
alter table public.hr_employees drop column if exists mutuelle_label;
alter table public.hr_employees drop column if exists cimr_rate;
alter table public.hr_employees drop column if exists cimr_enabled;
alter table public.hr_absences drop column if exists attachment_name;
alter table public.hr_absences drop column if exists attachment_path;
alter table public.hr_absences drop column if exists end_date;
alter table public.hr_advances drop column if exists deduction_year;
alter table public.hr_advances drop column if exists deduction_month;
alter table public.hr_expense_reports drop column if exists tax_rate;
