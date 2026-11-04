-- Rollback of 140. Drops only the helper created by that migration.
-- Corrected period totals are left in place: putting the previous zeros back
-- would recreate the damaged figures, and those previous figures were not stored.

drop function if exists app_private.recompute_hr_payroll_period_totals(uuid);
