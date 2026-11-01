-- Apply manually after105. Existing salaries, rates and payslips are preserved.
-- Base-only preparation; this migration does not enable final payroll or filing.
begin;

create or replace function app_private.guard_preparatory_payroll()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.status in ('validated','paid') then
    raise exception 'PAYROLL_PREPARATORY_ONLY' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function app_private.guard_preparatory_payroll() from public,anon,authenticated,service_role;
drop trigger if exists aa_preparatory_only_106 on public.hr_payroll_periods;
create trigger aa_preparatory_only_106 before insert or update on public.hr_payroll_periods for each row execute function app_private.guard_preparatory_payroll();
drop trigger if exists aa_preparatory_only_106 on public.hr_payslips;
create trigger aa_preparatory_only_106 before insert or update on public.hr_payslips for each row execute function app_private.guard_preparatory_payroll();
drop trigger if exists zz_pro_edit_version_106 on public.hr_payroll_periods;
create trigger zz_pro_edit_version_106 before update on public.hr_payroll_periods for each row execute function app_private.bump_pro_edit_version();

-- NOT VALID preserves historical rows; new/changed rows must contain real amounts.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='hr_employee_salary_valid_106' and conrelid='public.hr_employees'::regclass) then
    alter table public.hr_employees add constraint hr_employee_salary_valid_106 check(base_salary is not null and base_salary>=0 and base_salary::text not in ('NaN','Infinity','-Infinity')) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='hr_contract_salary_valid_106' and conrelid='public.hr_contracts'::regclass) then
    alter table public.hr_contracts add constraint hr_contract_salary_valid_106 check(base_salary is not null and base_salary>=0 and base_salary::text not in ('NaN','Infinity','-Infinity') and weekly_hours>0 and (end_date is null or end_date>=start_date)) not valid;
  end if;
end $$;

create or replace function public.prepare_hr_payroll_atomic(
  p_organization_id uuid,p_period_id uuid,p_expected_updated_at timestamptz,p_ack_base_only boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,app_private as $$
declare
  period public.hr_payroll_periods%rowtype; settings public.hr_settings%rowtype;
  employee public.hr_employees%rowtype; bracket jsonb; item jsonb;
  base numeric; cnss_base numeric; cnss numeric; amo numeric; taxable numeric; ir numeric;
  cnss_er numeric; amo_er numeric; net numeric; cost numeric;
  v_total_gross numeric:=0; v_total_net numeric:=0; v_total_cost numeric:=0; employee_count integer:=0;
  rates numeric[]; rate numeric; deduction numeric; previous_to numeric:=-1; lower_bound numeric; upper_bound numeric;
begin
  if auth.uid() is null then raise exception 'PRO_AUTH_REQUIRED' using errcode='42501'; end if;
  perform app_private.assert_pro_write_access(p_organization_id,true);
  if not public.hr_can_manage(p_organization_id) or app_private.is_operator_org_member(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then
    raise exception 'HR_MANAGEMENT_REQUIRED' using errcode='42501';
  end if;
  if p_ack_base_only is distinct from true then raise exception 'PAYROLL_BASE_ONLY_ACK_REQUIRED' using errcode='23514'; end if;
  select * into period from public.hr_payroll_periods where id=p_period_id and organization_id=p_organization_id for update;
  if period.id is null then raise exception 'PAYROLL_PERIOD_NOT_FOUND' using errcode='42501'; end if;
  if period.status not in ('draft','calculated') then raise exception 'PAYROLL_PERIOD_FINALIZED' using errcode='42501'; end if;
  if p_expected_updated_at is null or period.updated_at is distinct from p_expected_updated_at then raise exception 'PAYROLL_PERIOD_CHANGED' using errcode='40001'; end if;
  select * into settings from public.hr_settings where organization_id=p_organization_id for share;
  if settings.id is null or settings.cnss_enabled is null or settings.amo_enabled is null or settings.ir_enabled is null
    or coalesce(settings.payroll_currency,'')<>'MAD' then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
  rates:='{}'::numeric[];
  if settings.cnss_enabled then
    if settings.cnss_employee_rate is null or settings.cnss_employer_rate is null or settings.cnss_monthly_ceiling is null
      or settings.cnss_monthly_ceiling::text in ('NaN','Infinity','-Infinity') or settings.cnss_monthly_ceiling<=0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    rates:=rates||array[settings.cnss_employee_rate,settings.cnss_employer_rate];
  end if;
  if settings.amo_enabled then
    if settings.amo_employee_rate is null or settings.amo_employer_rate is null then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    rates:=rates||array[settings.amo_employee_rate,settings.amo_employer_rate];
  end if;
  foreach rate in array rates loop
    if rate::text in ('NaN','Infinity','-Infinity') or rate<=0 or rate>100 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
  end loop;
  if settings.ir_enabled then
    if jsonb_typeof(settings.ir_brackets) is distinct from 'array' or jsonb_array_length(settings.ir_brackets)=0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
    for item in select value from jsonb_array_elements(settings.ir_brackets) loop
      lower_bound:=(item->>'from')::numeric; upper_bound:=nullif(item->>'to','')::numeric; rate:=(item->>'rate')::numeric;
      deduction:=coalesce((item->>'deduction')::numeric,0);
      if lower_bound is null or rate is null or lower_bound::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity')
        or lower_bound<0 or lower_bound<=previous_to or rate<0 or rate>100
        or (upper_bound is not null and (upper_bound::text in ('NaN','Infinity','-Infinity') or upper_bound<lower_bound))
        or deduction::text in ('NaN','Infinity','-Infinity') or deduction<0 then raise exception 'PAYROLL_SETTINGS_REQUIRED' using errcode='23514'; end if;
      previous_to:=coalesce(upper_bound,'Infinity'::numeric);
    end loop;
  end if;
  -- Lock inputs and existing outputs before validating the entire set.
  perform id from public.hr_employees where organization_id=p_organization_id order by id for share;
  perform id from public.hr_payslips where organization_id=p_organization_id and payroll_period_id=p_period_id order by id for update;
  if exists(select 1 from public.hr_payslips s left join public.hr_employees e on e.id=s.employee_id and e.organization_id=p_organization_id
    where s.organization_id=p_organization_id and s.payroll_period_id=p_period_id and
      (s.status not in ('draft','calculated') or e.id is null or e.archived_at is not null or e.employment_status not in ('active','trial_period','on_leave'))) then
    raise exception 'PAYROLL_EXISTING_SLIPS_LOCKED' using errcode='42501';
  end if;
  for employee in select * from public.hr_employees where organization_id=p_organization_id and archived_at is null and employment_status in ('active','trial_period','on_leave') order by id for share loop
    base:=employee.base_salary;
    if base is null or base<0 or base::text in ('NaN','Infinity','-Infinity') then raise exception 'PAYROLL_INVALID_SALARY' using errcode='23514'; end if;
    cnss_base:=case when settings.cnss_enabled then least(base,settings.cnss_monthly_ceiling) else base end;
    cnss:=case when settings.cnss_enabled then round(cnss_base*settings.cnss_employee_rate/100,2) else 0 end;
    amo:=case when settings.amo_enabled then round(base*settings.amo_employee_rate/100,2) else 0 end;
    taxable:=base-cnss-amo; ir:=0;
    if settings.ir_enabled then
      select value into bracket from jsonb_array_elements(settings.ir_brackets) where taxable>=(value->>'from')::numeric and ((value->>'to') is null or taxable<=(value->>'to')::numeric);
      if bracket is null then raise exception 'PAYROLL_IR_BRACKET_MISSING' using errcode='23514'; end if;
      ir:=round(greatest(0,taxable*(bracket->>'rate')::numeric/100-coalesce((bracket->>'deduction')::numeric,0)),2);
    end if;
    net:=base-cnss-amo-ir;
    cnss_er:=case when settings.cnss_enabled then round(cnss_base*settings.cnss_employer_rate/100,2) else 0 end;
    amo_er:=case when settings.amo_enabled then round(base*settings.amo_employer_rate/100,2) else 0 end;
    cost:=base+cnss_er+amo_er;
    foreach rate in array array[base,cnss_base,cnss,amo,taxable,ir,net,cnss_er,amo_er,cost] loop
      if rate is null or rate::text in ('NaN','Infinity','-Infinity') or rate<0 then raise exception 'PAYROLL_INVALID_NET' using errcode='23514'; end if;
    end loop;
    insert into public.hr_payslips(organization_id,payroll_period_id,employee_id,payslip_number,base_salary,gross_salary,taxable_gross,net_salary,net_to_pay,employer_cost,cnss_employee,amo_employee,ir_amount,cnss_employer,amo_employer,earnings,deductions,employer_contributions,calculation_details,status)
      values(p_organization_id,p_period_id,employee.id,'BUL-'||period.year||'-'||lpad(period.month::text,2,'0')||'-'||employee.id::text,base,base,taxable,net,net,cost,cnss,amo,ir,cnss_er,amo_er,
        jsonb_build_array(jsonb_build_object('code','BASE','label','Salaire de base','amount',base)),
        jsonb_build_array(jsonb_build_object('code','CNSS_EMP','label','CNSS salarié','amount',cnss),jsonb_build_object('code','AMO_EMP','label','AMO salarié','amount',amo),jsonb_build_object('code','IR','label','IR préparatoire','amount',ir)),
        jsonb_build_array(jsonb_build_object('code','CNSS_ER','label','CNSS employeur','amount',cnss_er),jsonb_build_object('code','AMO_ER','label','AMO employeur','amount',amo_er)),
        jsonb_build_object('schemaStatus','preparatory','scope','base_only','officialConformityClaim',false,'variablesIncluded',false,'settingsUpdatedAt',settings.updated_at,'warnings',jsonb_build_array('Primes, heures supplémentaires, absences, avances et prêts exclus. Ce calcul ne permet ni validation finale ni paiement.')),'calculated')
      on conflict(payroll_period_id,employee_id) do update set base_salary=excluded.base_salary,gross_salary=excluded.gross_salary,taxable_gross=excluded.taxable_gross,net_salary=excluded.net_salary,net_to_pay=excluded.net_to_pay,employer_cost=excluded.employer_cost,cnss_employee=excluded.cnss_employee,amo_employee=excluded.amo_employee,ir_amount=excluded.ir_amount,cnss_employer=excluded.cnss_employer,amo_employer=excluded.amo_employer,earnings=excluded.earnings,deductions=excluded.deductions,employer_contributions=excluded.employer_contributions,calculation_details=excluded.calculation_details,status='calculated';
    employee_count:=employee_count+1;v_total_gross:=v_total_gross+base;v_total_net:=v_total_net+net;v_total_cost:=v_total_cost+cost;
  end loop;
  update public.hr_payroll_periods set status='calculated',total_gross=v_total_gross,total_net=v_total_net,total_employer_cost=v_total_cost,employees_count=employee_count
    where id=p_period_id and organization_id=p_organization_id;
  return jsonb_build_object('scope','base_only_preparatory','employees_count',employee_count,'total_gross',v_total_gross,'total_net',v_total_net,'total_employer_cost',v_total_cost);
end $$;
revoke all on function public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) from public,anon,authenticated,service_role;
grant execute on function public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)') is not null
  and exists(select 1 from pg_trigger where tgname='aa_preparatory_only_106' and tgrelid='public.hr_payroll_periods'::regclass)
  and exists(select 1 from pg_trigger where tgname='aa_preparatory_only_106' and tgrelid='public.hr_payslips'::regclass) as pro_106_actif;
