-- 138: tâches d'agenda et prorata du solde de tout compte.
-- Apply after 137. Additive. Existing settlements and agenda items are unchanged.
-- Rollback: supabase/rollbacks/138_agenda_tasks_and_settlement_prorata_rollback.sql

alter table public.hr_final_settlements add column if not exists salary_prorata numeric(14,2) not null default 0;
alter table public.hr_final_settlements add column if not exists days_worked numeric(8,2) not null default 0;

create table if not exists public.agenda_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  due_date date not null,
  third_party_id uuid references public.third_parties(id) on delete set null,
  done boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.agenda_tasks enable row level security;
drop policy if exists agenda_tasks_select on public.agenda_tasks;
create policy agenda_tasks_select on public.agenda_tasks for select to authenticated
  using (app_private.has_active_org_membership(organization_id));
drop policy if exists agenda_tasks_write on public.agenda_tasks;
create policy agenda_tasks_write on public.agenda_tasks for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
grant select, insert, update, delete on public.agenda_tasks to authenticated;
revoke all on public.agenda_tasks from anon;
