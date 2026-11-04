drop table if exists public.agenda_tasks;
alter table public.hr_final_settlements drop column if exists days_worked;
alter table public.hr_final_settlements drop column if exists salary_prorata;
