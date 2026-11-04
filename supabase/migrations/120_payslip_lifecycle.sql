-- 120: cycle bulletin brouillon -> validé -> payé.
-- Apply after 119. Do not reuse this number. Additive.
-- Replaces the body of app_private.guard_preparatory_payroll (migration 106)
-- so validated and paid are allowed, then freezes amounts.
-- Existing calculated slips stay calculated. Nothing is validated in mass.
--
-- Rollback (restores the 106 refusal of validated/paid):
-- create or replace function app_private.guard_preparatory_payroll()
-- returns trigger language plpgsql set search_path=pg_catalog as $$
-- begin
--   if new.status in ('validated','paid') then
--     raise exception 'PAYROLL_PREPARATORY_ONLY' using errcode='42501';
--   end if;
--   return new;
-- end $$;
-- revoke all on function app_private.guard_preparatory_payroll() from public, anon, authenticated, service_role;

create or replace function app_private.guard_preparatory_payroll()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if TG_OP = 'INSERT' and new.status not in ('draft', 'calculated') then
    raise exception 'PAYROLL_STATUS_TRANSITION' using errcode = '42501';
  end if;

  if TG_OP = 'UPDATE' then
    if old.status = 'paid' and new.status is distinct from 'paid' then
      raise exception 'PAYROLL_LOCKED' using errcode = '42501';
    end if;
    if old.status = 'validated' and new.status not in ('validated', 'paid') then
      raise exception 'PAYROLL_LOCKED' using errcode = '42501';
    end if;
    if old.status in ('draft', 'calculated') and new.status = 'paid' then
      raise exception 'PAYROLL_STATUS_TRANSITION' using errcode = '42501';
    end if;
    if old.status in ('validated', 'paid') and TG_TABLE_NAME = 'hr_payslips' then
      if new.base_salary is distinct from old.base_salary
        or new.gross_salary is distinct from old.gross_salary
        or new.taxable_gross is distinct from old.taxable_gross
        or new.net_salary is distinct from old.net_salary
        or new.net_to_pay is distinct from old.net_to_pay
        or new.employer_cost is distinct from old.employer_cost
        or new.cnss_employee is distinct from old.cnss_employee
        or new.amo_employee is distinct from old.amo_employee
        or new.ir_amount is distinct from old.ir_amount
        or new.advance_deduction is distinct from old.advance_deduction
        or new.cnss_employer is distinct from old.cnss_employer
        or new.amo_employer is distinct from old.amo_employer
        or new.earnings is distinct from old.earnings
        or new.deductions is distinct from old.deductions
        or new.employer_contributions is distinct from old.employer_contributions
        or new.calculation_details is distinct from old.calculation_details
        or new.employee_id is distinct from old.employee_id
        or new.payroll_period_id is distinct from old.payroll_period_id
      then
        raise exception 'PAYROLL_LOCKED' using errcode = '42501';
      end if;
    end if;
    if old.status in ('validated', 'paid') and TG_TABLE_NAME = 'hr_payroll_periods' then
      if new.total_gross is distinct from old.total_gross
        or new.total_net is distinct from old.total_net
        or new.total_employer_cost is distinct from old.total_employer_cost
        or new.employees_count is distinct from old.employees_count
        or new.month is distinct from old.month
        or new.year is distinct from old.year
      then
        raise exception 'PAYROLL_LOCKED' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end $$;

revoke all on function app_private.guard_preparatory_payroll() from public, anon, authenticated, service_role;
