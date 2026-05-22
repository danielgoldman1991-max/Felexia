create or replace function public.hr_is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
  );
$$;

create or replace function public.hr_can_manage(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    left join public.roles r on r.id = om.role_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
      and coalesce(r.name, '') in ('owner', 'admin', 'hr_manager', 'accountant')
  );
$$;

create table if not exists public.hr_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text null,
  manager_employee_id uuid null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.hr_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid null references public.hr_departments(id) on delete set null,
  title text not null,
  code text null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, title)
);

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  gender text null,
  birth_date date null,
  nationality text not null default 'Marocaine',
  cin text null,
  passport_number text null,
  marital_status text null,
  dependents_count integer not null default 0,
  email text null,
  phone text null,
  address text null,
  city text null,
  department_id uuid null references public.hr_departments(id) on delete set null,
  position_id uuid null references public.hr_positions(id) on delete set null,
  manager_employee_id uuid null references public.hr_employees(id) on delete set null,
  hire_date date not null,
  exit_date date null,
  employment_status text not null default 'active' check (employment_status in ('active','trial_period','suspended','on_leave','terminated','archived')),
  cnss_number text null,
  amo_number text null,
  cimr_number text null,
  tax_identifier text null,
  bank_name text null,
  rib text null,
  base_salary numeric(14,2) not null default 0,
  salary_type text not null default 'monthly' check (salary_type in ('monthly','daily','hourly')),
  payment_method text default 'bank_transfer' check (payment_method in ('bank_transfer','cash','cheque','other')),
  emergency_contact_name text null,
  emergency_contact_phone text null,
  notes text null,
  avatar_url text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  unique (organization_id, employee_number)
);

alter table public.hr_departments
  add constraint hr_departments_manager_employee_id_fkey
  foreign key (manager_employee_id) references public.hr_employees(id) on delete set null;

create table if not exists public.hr_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  contract_number text not null,
  contract_type text not null check (contract_type in ('CDI','CDD','ANAPEC','STAGE','INTERIM','CONSULTANT','OTHER')),
  start_date date not null,
  end_date date null,
  trial_period_end date null,
  status text not null default 'active' check (status in ('draft','active','expired','terminated','archived')),
  working_time_type text default 'full_time',
  weekly_hours numeric(8,2) default 44,
  base_salary numeric(14,2) not null default 0,
  benefits jsonb not null default '{}'::jsonb,
  clauses text null,
  signed_at date null,
  document_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_number)
);

create table if not exists public.hr_leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  is_paid boolean not null default true,
  annual_entitlement_days numeric(8,2) null,
  requires_approval boolean not null default true,
  color text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_type_id uuid not null references public.hr_leave_types(id),
  start_date date not null,
  end_date date not null,
  days_count numeric(8,2) not null,
  reason text null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_reason text null,
  attachment_document_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  attendance_date date not null,
  check_in timestamptz null,
  check_out timestamptz null,
  worked_hours numeric(8,2) default 0,
  overtime_hours numeric(8,2) default 0,
  late_minutes integer default 0,
  status text not null default 'present' check (status in ('present','absent','late','half_day','leave','sick_leave','remote','holiday')),
  source text default 'manual',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, attendance_date)
);

create table if not exists public.hr_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  absence_date date not null,
  absence_type text not null,
  justified boolean not null default false,
  reason text null,
  status text not null default 'draft' check (status in ('draft','validated','cancelled')),
  attachment_document_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_number text not null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2200),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','calculated','validated','paid','archived')),
  total_gross numeric(14,2) default 0,
  total_net numeric(14,2) default 0,
  total_employer_cost numeric(14,2) default 0,
  employees_count integer default 0,
  notes text null,
  created_by uuid null,
  validated_by uuid null,
  validated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, month, year)
);

create table if not exists public.hr_payslips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid not null references public.hr_payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  payslip_number text not null,
  base_salary numeric(14,2) default 0,
  gross_salary numeric(14,2) default 0,
  taxable_gross numeric(14,2) default 0,
  net_salary numeric(14,2) default 0,
  net_to_pay numeric(14,2) default 0,
  employer_cost numeric(14,2) default 0,
  cnss_employee numeric(14,2) default 0,
  amo_employee numeric(14,2) default 0,
  cimr_employee numeric(14,2) default 0,
  ir_amount numeric(14,2) default 0,
  advance_deduction numeric(14,2) default 0,
  loan_deduction numeric(14,2) default 0,
  other_deductions numeric(14,2) default 0,
  cnss_employer numeric(14,2) default 0,
  amo_employer numeric(14,2) default 0,
  cimr_employer numeric(14,2) default 0,
  earnings jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  employer_contributions jsonb not null default '[]'::jsonb,
  calculation_details jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','calculated','validated','paid','cancelled')),
  paid_at date null,
  payment_reference text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, payslip_number),
  unique (payroll_period_id, employee_id)
);

create table if not exists public.hr_salary_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  item_type text not null check (item_type in ('earning','deduction','employer_contribution')),
  calculation_type text not null default 'fixed' check (calculation_type in ('fixed','percentage','formula','manual')),
  default_amount numeric(14,2) default 0,
  default_rate numeric(8,4) default 0,
  taxable boolean default true,
  subject_to_cnss boolean default true,
  subject_to_amo boolean default true,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.hr_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  advance_number text not null,
  request_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'draft' check (status in ('draft','approved','paid','deducted','cancelled')),
  approved_by uuid null,
  approved_at timestamptz null,
  paid_at date null,
  payment_method text null,
  treasury_transaction_id uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, advance_number)
);

create table if not exists public.hr_loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  loan_number text not null,
  amount numeric(14,2) not null check (amount > 0),
  monthly_deduction numeric(14,2) not null check (monthly_deduction >= 0),
  start_month integer not null check (start_month between 1 and 12),
  start_year integer not null check (start_year between 2000 and 2200),
  remaining_amount numeric(14,2) not null,
  status text not null default 'active' check (status in ('active','closed','suspended','cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, loan_number)
);

create table if not exists public.hr_expense_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  expense_number text not null,
  expense_date date not null,
  category text not null,
  amount_ht numeric(14,2) default 0,
  tax_amount numeric(14,2) default 0,
  amount_ttc numeric(14,2) default 0,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','paid','archived')),
  approved_by uuid null,
  approved_at timestamptz null,
  paid_at date null,
  document_id uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, expense_number)
);

create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid null references public.hr_employees(id) on delete cascade,
  document_type text not null,
  title text not null,
  file_path text null,
  file_url text null,
  expires_at date null,
  status text default 'active',
  created_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  evaluator_id uuid null references public.hr_employees(id),
  evaluation_date date not null,
  period_label text null,
  score numeric(5,2) null,
  strengths text null,
  improvements text null,
  goals text null,
  status text default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.hr_disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id),
  action_date date not null,
  action_type text not null check (action_type in ('observation','warning','blame','suspension','termination_notice','other')),
  reason text not null,
  decision text null,
  status text default 'draft',
  document_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  default_weekly_hours numeric(8,2) default 44,
  default_annual_leave_days numeric(8,2) default 18,
  leave_accrual_days_per_month numeric(8,2) default 1.5,
  payroll_currency text default 'MAD',
  payroll_rounding text default 'nearest_cent',
  cnss_enabled boolean default true,
  amo_enabled boolean default true,
  ir_enabled boolean default true,
  cnss_employee_rate numeric(8,4) null,
  cnss_employer_rate numeric(8,4) null,
  amo_employee_rate numeric(8,4) null,
  amo_employer_rate numeric(8,4) null,
  cnss_monthly_ceiling numeric(14,2) null,
  ir_brackets jsonb not null default '[]'::jsonb,
  payroll_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_employees_org_status_idx on public.hr_employees (organization_id, employment_status);
create index if not exists hr_contracts_org_employee_idx on public.hr_contracts (organization_id, employee_id);
create index if not exists hr_leave_requests_org_status_idx on public.hr_leave_requests (organization_id, status);
create index if not exists hr_attendance_org_date_idx on public.hr_attendance (organization_id, attendance_date);
create index if not exists hr_payroll_periods_org_period_idx on public.hr_payroll_periods (organization_id, year, month);
create index if not exists hr_payslips_org_period_idx on public.hr_payslips (organization_id, payroll_period_id);
create index if not exists hr_documents_org_employee_idx on public.hr_documents (organization_id, employee_id);

do $$
declare
  hr_table text;
begin
  foreach hr_table in array array[
    'hr_departments','hr_positions','hr_employees','hr_contracts','hr_leave_types','hr_leave_requests',
    'hr_attendance','hr_absences','hr_payroll_periods','hr_payslips','hr_salary_items','hr_advances',
    'hr_loans','hr_expense_reports','hr_documents','hr_evaluations','hr_disciplinary_actions','hr_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', hr_table);

    execute format('drop policy if exists %I_select on public.%I', hr_table, hr_table);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.hr_is_org_member(organization_id))', hr_table, hr_table);

    execute format('drop policy if exists %I_insert on public.%I', hr_table, hr_table);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.hr_can_manage(organization_id))', hr_table, hr_table);

    execute format('drop policy if exists %I_update on public.%I', hr_table, hr_table);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.hr_can_manage(organization_id)) with check (public.hr_can_manage(organization_id))', hr_table, hr_table);

    execute format('drop policy if exists %I_delete on public.%I', hr_table, hr_table);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (false)', hr_table, hr_table);

    execute format('drop trigger if exists %I_set_updated_at on public.%I', hr_table, hr_table);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = hr_table and column_name = 'updated_at'
    ) then
      execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', hr_table, hr_table);
    end if;
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-documents',
  'hr-documents',
  false,
  52428800,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

drop policy if exists hr_documents_storage_read on storage.objects;
drop policy if exists hr_documents_storage_insert on storage.objects;
drop policy if exists hr_documents_storage_update on storage.objects;
drop policy if exists hr_documents_storage_delete on storage.objects;

create policy hr_documents_storage_read
on storage.objects
for select
to authenticated
using (bucket_id = 'hr-documents');

create policy hr_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'hr-documents');

create policy hr_documents_storage_update
on storage.objects
for update
to authenticated
using (bucket_id = 'hr-documents')
with check (bucket_id = 'hr-documents');

create policy hr_documents_storage_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'hr-documents');
