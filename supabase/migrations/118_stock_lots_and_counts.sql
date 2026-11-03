-- 118: lots, séries, dates de péremption et inventaire physique.
-- Additive. Existing stock levels and the CUMP path are unchanged.
--
-- Rollback:
-- drop trigger if exists aa_pro_member_write on public.stock_count_lines;
-- drop trigger if exists aa_pro_member_write on public.stock_counts;
-- drop trigger if exists aa_pro_member_write on public.stock_serials;
-- drop trigger if exists aa_pro_member_write on public.stock_lots;
-- drop table if exists public.stock_count_lines;
-- drop table if exists public.stock_counts;
-- drop table if exists public.stock_serials;
-- drop table if exists public.stock_lots;

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

create table if not exists public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  lot_code text not null,
  expires_on date,
  quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, product_id, lot_code)
);

create table if not exists public.stock_serials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  serial_number text not null,
  status text not null default 'in_stock',
  created_at timestamptz not null default now(),
  unique (organization_id, serial_number)
);

create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  count_number text not null,
  counted_on date not null default current_date,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique (organization_id, count_number)
);

create table if not exists public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  count_id uuid not null references public.stock_counts(id) on delete cascade,
  product_id uuid not null,
  theoretical_quantity numeric(14,3) not null default 0,
  counted_quantity numeric(14,3) not null default 0,
  variance_quantity numeric(14,3) not null default 0
);

do $$ begin
  alter table public.stock_serials add constraint stock_serials_status_check check (status in ('in_stock', 'issued', 'scrapped'));
exception when duplicate_object then null;
end $$;

alter table public.stock_lots enable row level security;
alter table public.stock_serials enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;

drop policy if exists stock_lots_select on public.stock_lots;
create policy stock_lots_select on public.stock_lots for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists stock_lots_write on public.stock_lots;
create policy stock_lots_write on public.stock_lots for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists stock_serials_select on public.stock_serials;
create policy stock_serials_select on public.stock_serials for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists stock_serials_write on public.stock_serials;
create policy stock_serials_write on public.stock_serials for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists stock_counts_select on public.stock_counts;
create policy stock_counts_select on public.stock_counts for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists stock_counts_write on public.stock_counts;
create policy stock_counts_write on public.stock_counts for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));
drop policy if exists stock_count_lines_select on public.stock_count_lines;
create policy stock_count_lines_select on public.stock_count_lines for select to authenticated using (app_private.has_active_org_membership(organization_id));
drop policy if exists stock_count_lines_write on public.stock_count_lines;
create policy stock_count_lines_write on public.stock_count_lines for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

grant select, insert, update, delete on public.stock_lots, public.stock_serials, public.stock_counts, public.stock_count_lines to authenticated;
revoke all on public.stock_lots, public.stock_serials, public.stock_counts, public.stock_count_lines from anon;

drop trigger if exists aa_pro_member_write on public.stock_lots;
create trigger aa_pro_member_write before insert or update or delete on public.stock_lots for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.stock_serials;
create trigger aa_pro_member_write before insert or update or delete on public.stock_serials for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.stock_counts;
create trigger aa_pro_member_write before insert or update or delete on public.stock_counts for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.stock_count_lines;
create trigger aa_pro_member_write before insert or update or delete on public.stock_count_lines for each row execute function app_private.guard_pro_member_write();
