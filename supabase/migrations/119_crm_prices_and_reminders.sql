-- 119: pipeline commercial, listes de prix et règles de relance.
-- Apply after 118. Do not reuse this number.
-- Additive. Existing quotes, invoices and reminders are unchanged.
--
-- Rollback:
-- drop trigger if exists aa_pro_member_write on public.customer_reminder_rules;
-- drop trigger if exists aa_pro_member_write on public.customer_price_list_items;
-- drop trigger if exists aa_pro_member_write on public.customer_price_lists;
-- drop trigger if exists aa_pro_member_write on public.crm_opportunities;
-- drop table if exists public.customer_reminder_rules;
-- drop table if exists public.customer_price_list_items;
-- drop table if exists public.customer_price_lists;
-- drop table if exists public.crm_opportunities;

create or replace function app_private.guard_pro_member_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
begin
  perform app_private.assert_pro_write_access(org, true);
  if auth.uid() is not null and app_private.is_read_only_org_member(org) then
    raise exception 'READ_ONLY' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.guard_pro_member_write() from public, anon, authenticated;

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  customer_name text,
  stage text not null default 'qualification',
  amount numeric(14,2) not null default 0,
  expected_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  discount_percent numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.customer_price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  price_list_id uuid not null references public.customer_price_lists(id) on delete cascade,
  product_id uuid,
  description text not null,
  unit_price numeric(14,2) not null default 0
);

create table if not exists public.customer_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  days_after_due integer not null default 7,
  level integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.crm_opportunities add constraint crm_opportunities_stage_check check (stage in ('qualification', 'proposition', 'negociation', 'gagnee', 'perdue'));
exception when duplicate_object then null; end $$;

alter table public.crm_opportunities enable row level security;
alter table public.customer_price_lists enable row level security;
alter table public.customer_price_list_items enable row level security;
alter table public.customer_reminder_rules enable row level security;

drop policy if exists crm_opportunities_select on public.crm_opportunities;
create policy crm_opportunities_select on public.crm_opportunities for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists crm_opportunities_write on public.crm_opportunities;
create policy crm_opportunities_write on public.crm_opportunities for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists customer_price_lists_select on public.customer_price_lists;
create policy customer_price_lists_select on public.customer_price_lists for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists customer_price_lists_write on public.customer_price_lists;
create policy customer_price_lists_write on public.customer_price_lists for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists customer_price_list_items_select on public.customer_price_list_items;
create policy customer_price_list_items_select on public.customer_price_list_items for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists customer_price_list_items_write on public.customer_price_list_items;
create policy customer_price_list_items_write on public.customer_price_list_items for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists customer_reminder_rules_select on public.customer_reminder_rules;
create policy customer_reminder_rules_select on public.customer_reminder_rules for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists customer_reminder_rules_write on public.customer_reminder_rules;
create policy customer_reminder_rules_write on public.customer_reminder_rules for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

grant select, insert, update, delete on public.crm_opportunities, public.customer_price_lists, public.customer_price_list_items, public.customer_reminder_rules to authenticated;
revoke all on public.crm_opportunities, public.customer_price_lists, public.customer_price_list_items, public.customer_reminder_rules from anon;

drop trigger if exists aa_pro_member_write on public.crm_opportunities;
create trigger aa_pro_member_write before insert or update or delete on public.crm_opportunities for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.customer_price_lists;
create trigger aa_pro_member_write before insert or update or delete on public.customer_price_lists for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.customer_price_list_items;
create trigger aa_pro_member_write before insert or update or delete on public.customer_price_list_items for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.customer_reminder_rules;
create trigger aa_pro_member_write before insert or update or delete on public.customer_reminder_rules for each row execute function app_private.guard_pro_member_write();
