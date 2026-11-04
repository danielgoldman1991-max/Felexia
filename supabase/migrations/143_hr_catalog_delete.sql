-- 143: let HR managers delete unused catalog rows.
-- Migration 082 created delete policies with using (false) on hr_departments,
-- hr_positions and hr_leave_types. PostgREST then deletes 0 rows and returns
-- no error. Schedules already allow delete through hr_work_schedules_write.
-- This replaces only those three deny-all policies. Existing rows stay.
-- Rollback: supabase/rollbacks/143_hr_catalog_delete_rollback.sql

drop policy if exists hr_departments_delete on public.hr_departments;
create policy hr_departments_delete on public.hr_departments
  for delete to authenticated
  using (
    public.hr_can_manage(organization_id)
    and not app_private.is_read_only_org_member(organization_id)
    and not app_private.is_operator_org_member(organization_id)
  );

drop policy if exists hr_positions_delete on public.hr_positions;
create policy hr_positions_delete on public.hr_positions
  for delete to authenticated
  using (
    public.hr_can_manage(organization_id)
    and not app_private.is_read_only_org_member(organization_id)
    and not app_private.is_operator_org_member(organization_id)
  );

drop policy if exists hr_leave_types_delete on public.hr_leave_types;
create policy hr_leave_types_delete on public.hr_leave_types
  for delete to authenticated
  using (
    public.hr_can_manage(organization_id)
    and not app_private.is_read_only_org_member(organization_id)
    and not app_private.is_operator_org_member(organization_id)
  );
