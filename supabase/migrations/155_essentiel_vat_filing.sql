-- 155: déclarations TVA et réglage de périodicité pour ESSENTIEL et PRO.
-- Additive. N'ouvre ni devis, ni stock, ni RH, ni tax_export_batches, ni le dépôt CNSS/IS.
-- Rollback: supabase/rollbacks/155_essentiel_vat_filing_rollback.sql

begin;

drop policy if exists pro_read_guard_110 on public.vat_declarations;
drop trigger if exists aa_pro_erp_write_guard on public.vat_declarations;

create or replace function app_private.guard_vat_declaration_write()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
begin
  perform app_private.assert_essential_write_access(org);
  if auth.uid() is not null and (app_private.is_read_only_org_member(org) or app_private.is_operator_org_member(org)) then
    raise exception 'VAT_DECLARATION_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if TG_OP = 'UPDATE' and old.organization_id is distinct from new.organization_id then
    raise exception 'ORGANIZATION_IMMUTABLE' using errcode = '42501';
  end if;
  if TG_OP = 'UPDATE' and (to_jsonb(old) ->> 'id') is distinct from (to_jsonb(new) ->> 'id') then
    raise exception 'IMMUTABLE_RECORD_KEY' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.guard_vat_declaration_write() from public, anon, authenticated;
drop trigger if exists aa_vat_declaration_write on public.vat_declarations;
create trigger aa_vat_declaration_write
  before insert or update or delete on public.vat_declarations
  for each row execute function app_private.guard_vat_declaration_write();

revoke all on public.vat_declarations from anon;

alter table public.organization_fiscal_settings
  add column if not exists vat_regime text;
do $$ begin
  alter table public.organization_fiscal_settings
    add constraint organization_fiscal_settings_vat_regime_check
    check (vat_regime is null or vat_regime in ('encaissement', 'debit', 'mixed', 'unspecified'));
exception when duplicate_object then null;
end $$;

create or replace function app_private.guard_fiscal_settings_write()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
  vat_only boolean := false;
begin
  if TG_OP = 'UPDATE' then
    vat_only := (to_jsonb(new) - 'vat_frequency' - 'vat_regime' - 'updated_at')
      is not distinct from (to_jsonb(old) - 'vat_frequency' - 'vat_regime' - 'updated_at');
  elsif TG_OP = 'INSERT' then
    vat_only := new.cnss_affiliation is null
      and new.is_rate_percent is null
      and new.activity_code is null
      and new.filing_note is null;
  end if;
  perform app_private.assert_pro_write_access(org, not vat_only);
  if auth.uid() is not null and (app_private.is_read_only_org_member(org) or app_private.is_operator_org_member(org)) then
    raise exception 'FISCAL_SETTINGS_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.guard_fiscal_settings_write() from public, anon, authenticated;
drop trigger if exists aa_pro_member_write on public.organization_fiscal_settings;
drop trigger if exists aa_fiscal_settings_write on public.organization_fiscal_settings;
create trigger aa_fiscal_settings_write
  before insert or update or delete on public.organization_fiscal_settings
  for each row execute function app_private.guard_fiscal_settings_write();

create or replace function public.get_organization_vat_filing(p_organization_id uuid)
returns table (vat_frequency text, vat_regime text)
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) then
    raise exception 'VAT_FILING_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  return query
    select s.vat_frequency, s.vat_regime
    from public.organization_fiscal_settings s
    where s.organization_id = p_organization_id;
  if not found then
    vat_frequency := 'monthly';
    vat_regime := 'unspecified';
    return next;
  end if;
end $$;
revoke all on function public.get_organization_vat_filing(uuid) from public, anon;
grant execute on function public.get_organization_vat_filing(uuid) to authenticated;

create or replace function public.set_organization_vat_filing(p_organization_id uuid, p_frequency text, p_regime text)
returns void
language plpgsql
volatile
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) then
    raise exception 'VAT_FILING_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  perform app_private.assert_essential_write_access(p_organization_id);
  if app_private.is_read_only_org_member(p_organization_id) or app_private.is_operator_org_member(p_organization_id) then
    raise exception 'VAT_FILING_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_frequency not in ('monthly', 'quarterly') or p_regime not in ('encaissement', 'debit', 'mixed', 'unspecified') then
    raise exception 'VAT_FILING_VALUE_INVALID' using errcode = '22023';
  end if;
  insert into public.organization_fiscal_settings (organization_id, vat_frequency, vat_regime, updated_at)
  values (p_organization_id, p_frequency, p_regime, now())
  on conflict (organization_id) do update
    set vat_frequency = excluded.vat_frequency,
        vat_regime = excluded.vat_regime,
        updated_at = now();
end $$;
revoke all on function public.set_organization_vat_filing(uuid, text, text) from public, anon;
grant execute on function public.set_organization_vat_filing(uuid, text, text) to authenticated;

commit;
