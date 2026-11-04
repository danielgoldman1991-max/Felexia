-- Rollback of 123. Drops only the tables introduced by that migration.
-- Existing leave requests, contracts, employees and notifications are kept.

drop trigger if exists aa_pro_member_write on public.hr_employee_checks;
drop trigger if exists aa_pro_member_write on public.hr_final_settlements;
drop trigger if exists aa_pro_member_write on public.hr_leave_decisions;
drop table if exists public.hr_employee_checks;
drop table if exists public.hr_final_settlements;
drop table if exists public.hr_leave_decisions;
