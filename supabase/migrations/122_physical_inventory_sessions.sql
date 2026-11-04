-- 122: session d'inventaire physique (emplacement, validation, historique).
-- Apply after 121. Additive. Existing stock_counts rows stay drafts.
--
-- Rollback:
-- drop trigger if exists aa_inventory_lock_122 on public.stock_count_lines;
-- drop trigger if exists aa_inventory_lock_122 on public.stock_counts;
-- drop function if exists app_private.guard_inventory_lock();
-- alter table public.stock_count_lines drop column if exists warehouse_id;
-- alter table public.stock_count_lines drop column if exists movement_note;
-- alter table public.stock_counts drop column if exists warehouse_id;
-- alter table public.stock_counts drop column if exists notes;
-- alter table public.stock_counts drop column if exists validated_at;

alter table public.stock_counts add column if not exists warehouse_id uuid;
alter table public.stock_counts add column if not exists notes text;
alter table public.stock_counts add column if not exists validated_at timestamptz;
alter table public.stock_count_lines add column if not exists warehouse_id uuid;
alter table public.stock_count_lines add column if not exists movement_note text;

do $$ begin
  alter table public.stock_counts
    add constraint stock_counts_status_check
    check (status in ('draft', 'validated'));
exception when duplicate_object then null;
end $$;

create or replace function app_private.guard_inventory_lock()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  parent_status text;
begin
  if TG_TABLE_NAME = 'stock_counts' and TG_OP = 'UPDATE' and old.status = 'validated' then
    raise exception 'INVENTORY_LOCKED' using errcode = '42501';
  end if;
  if TG_TABLE_NAME = 'stock_counts' and TG_OP = 'DELETE' and old.status = 'validated' then
    raise exception 'INVENTORY_LOCKED' using errcode = '42501';
  end if;
  if TG_TABLE_NAME = 'stock_count_lines' then
    select status into parent_status from public.stock_counts where id = coalesce(new.count_id, old.count_id);
    if parent_status = 'validated' then
      raise exception 'INVENTORY_LOCKED' using errcode = '42501';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function app_private.guard_inventory_lock() from public, anon, authenticated, service_role;

drop trigger if exists aa_inventory_lock_122 on public.stock_counts;
create trigger aa_inventory_lock_122
  before update or delete on public.stock_counts
  for each row execute function app_private.guard_inventory_lock();

drop trigger if exists aa_inventory_lock_122 on public.stock_count_lines;
create trigger aa_inventory_lock_122
  before insert or update or delete on public.stock_count_lines
  for each row execute function app_private.guard_inventory_lock();
