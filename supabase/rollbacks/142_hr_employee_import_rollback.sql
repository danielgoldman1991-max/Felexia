-- Rollback of 142. Drops only the import function created by that migration.
-- Employees already imported stay. They were ordinary hr_employees rows.

drop function if exists public.import_hr_employees_batch(uuid, jsonb);
