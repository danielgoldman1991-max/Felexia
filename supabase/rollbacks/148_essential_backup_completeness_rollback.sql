-- Rollback of 148 policies. Function bodies return to 147 by reapplying that migration
-- after this file. No business data is deleted.

drop policy if exists company_settings_admin_update_148 on public.company_settings;
drop policy if exists company_settings_admin_insert_148 on public.company_settings;
drop policy if exists organizations_admin_update_148 on public.organizations;
