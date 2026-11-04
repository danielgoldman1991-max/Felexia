-- Rollback of 124. Drops only organization_fiscal_settings.

drop trigger if exists aa_pro_member_write on public.organization_fiscal_settings;
drop table if exists public.organization_fiscal_settings;
