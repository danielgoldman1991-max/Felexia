-- 140: recompute payroll period totals from the bulletins that still exist.
-- Additive. Idempotent. Does not delete or rewrite bulletin rows.
-- A validated period whose totals were overwritten with 0 is restored from its payslips.
-- The lock trigger is suspended only for this correction, then re-enabled.
-- Do not apply from the application. Apply manually after a backup.
-- Rollback: supabase/rollbacks/140_recompute_payroll_period_totals_rollback.sql
-- The rollback drops the helper function only. It does not put the wrong zeros back.

create or replace function app_private.recompute_hr_payroll_period_totals(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross numeric(14,2);
  v_net numeric(14,2);
  v_cost numeric(14,2);
  v_count integer;
begin
  if to_regclass('public.hr_payslips') is null or to_regclass('public.hr_payroll_periods') is null then
    return;
  end if;
  select
    coalesce(sum(gross_salary), 0),
    coalesce(sum(net_to_pay), 0),
    coalesce(sum(employer_cost), 0),
    count(*)::integer
  into v_gross, v_net, v_cost, v_count
  from public.hr_payslips
  where payroll_period_id = p_period_id
    and status is distinct from 'cancelled';

  update public.hr_payroll_periods
  set total_gross = v_gross,
      total_net = v_net,
      total_employer_cost = v_cost,
      employees_count = v_count
  where id = p_period_id
    and (
      total_gross is distinct from v_gross
      or total_net is distinct from v_net
      or total_employer_cost is distinct from v_cost
      or employees_count is distinct from v_count
    );
end;
$$;

revoke all on function app_private.recompute_hr_payroll_period_totals(uuid) from public, anon, authenticated;

do $$
declare
  period_id uuid;
  locked boolean := exists (
    select 1 from pg_trigger
    where tgname = 'aa_preparatory_only_106'
      and tgrelid = 'public.hr_payroll_periods'::regclass
  );
begin
  if to_regclass('public.hr_payroll_periods') is null then
    return;
  end if;
  if locked then
    alter table public.hr_payroll_periods disable trigger aa_preparatory_only_106;
  end if;
  for period_id in
    select p.id
    from public.hr_payroll_periods p
    left join lateral (
      select
        coalesce(sum(s.gross_salary), 0) as gross,
        coalesce(sum(s.net_to_pay), 0) as net,
        coalesce(sum(s.employer_cost), 0) as cost,
        count(*)::integer as slips
      from public.hr_payslips s
      where s.payroll_period_id = p.id
        and s.status is distinct from 'cancelled'
    ) totals on true
    where p.total_gross is distinct from totals.gross
      or p.total_net is distinct from totals.net
      or p.total_employer_cost is distinct from totals.cost
      or p.employees_count is distinct from totals.slips
  loop
    perform app_private.recompute_hr_payroll_period_totals(period_id);
  end loop;
  if locked then
    alter table public.hr_payroll_periods enable trigger aa_preparatory_only_106;
  end if;
exception
  when others then
    if locked then
      alter table public.hr_payroll_periods enable trigger aa_preparatory_only_106;
    end if;
    raise;
end;
$$;
