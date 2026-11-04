-- Rollback of 143. Restores the original deny-all delete policies.
-- No catalog row is restored or removed.

drop policy if exists hr_departments_delete on public.hr_departments;
create policy hr_departments_delete on public.hr_departments
  for delete to authenticated
  using (false);

drop policy if exists hr_positions_delete on public.hr_positions;
create policy hr_positions_delete on public.hr_positions
  for delete to authenticated
  using (false);

drop policy if exists hr_leave_types_delete on public.hr_leave_types;
create policy hr_leave_types_delete on public.hr_leave_types
  for delete to authenticated
  using (false);
