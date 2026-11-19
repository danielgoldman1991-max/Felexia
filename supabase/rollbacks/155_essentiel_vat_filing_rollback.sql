-- Rollback of 155. Restores the PRO read policy and write trigger on vat_declarations only.
begin;

drop trigger if exists aa_vat_declaration_write on public.vat_declarations;
drop function if exists app_private.guard_vat_declaration_write();

drop policy if exists pro_read_guard_110 on public.vat_declarations;
create policy pro_read_guard_110 on public.vat_declarations
  as restrictive for select to authenticated
  using (app_private.can_read_pro_erp_110(organization_id));

drop trigger if exists aa_pro_erp_write_guard on public.vat_declarations;
create trigger aa_pro_erp_write_guard
  before insert or update or delete on public.vat_declarations
  for each row execute function app_private.guard_pro_erp_write();

drop function if exists public.set_organization_vat_filing(uuid, text, text);
drop function if exists public.get_organization_vat_filing(uuid);

drop trigger if exists aa_fiscal_settings_write on public.organization_fiscal_settings;
drop function if exists app_private.guard_fiscal_settings_write();
drop trigger if exists aa_pro_member_write on public.organization_fiscal_settings;
create trigger aa_pro_member_write
  before insert or update or delete on public.organization_fiscal_settings
  for each row execute function app_private.guard_pro_member_write();

alter table public.organization_fiscal_settings drop constraint if exists organization_fiscal_settings_vat_regime_check;
alter table public.organization_fiscal_settings drop column if exists vat_regime;

commit;
