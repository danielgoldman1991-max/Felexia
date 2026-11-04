-- 142: all-or-nothing employee CSV import.
-- Apply after 141. Additive. Existing employees are not changed.
-- One failing row rolls the whole call back.
-- Rollback: supabase/rollbacks/142_hr_employee_import_rollback.sql

create or replace function public.import_hr_employees_batch(p_organization_id uuid, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  inserted integer := 0;
begin
  if actor is null or not public.hr_is_org_member(p_organization_id) or not public.hr_can_manage(p_organization_id) then
    raise exception 'HR_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'HR_IMPORT_EMPTY' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'HR_IMPORT_TOO_LARGE' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    insert into public.hr_employees (
      organization_id, employee_number, first_name, last_name, hire_date, base_salary,
      cin, cnss_number, rib, email, city, dependents_count, created_by
    ) values (
      p_organization_id,
      item->>'employeeNumber',
      item->>'firstName',
      item->>'lastName',
      (item->>'hireDate')::date,
      round((item->>'baseSalary')::numeric, 2),
      nullif(item->>'cin', ''),
      nullif(item->>'cnss', ''),
      nullif(item->>'rib', ''),
      nullif(item->>'email', ''),
      nullif(item->>'city', ''),
      coalesce((item->>'dependents')::integer, 0),
      actor
    );
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

revoke all on function public.import_hr_employees_batch(uuid, jsonb) from public, anon;
grant execute on function public.import_hr_employees_batch(uuid, jsonb) to authenticated;
