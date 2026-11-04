-- 131: le verrou d'inventaire ne doit pas lire stock_count_lines.status.
-- Cette colonne n'existe pas. L'expression unique « old.status » échouait (42703)
-- sur chaque insertion de ligne, donc la feuille de comptage restait vide.
-- Aucune donnée n'est lue, déplacée ou supprimée.
--
-- Rollback: supabase/rollbacks/131_inventory_count_line_lock_rollback.sql

create or replace function app_private.guard_inventory_lock()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  parent_status text;
begin
  if TG_TABLE_NAME = 'stock_counts' then
    if TG_OP = 'UPDATE' and old.status = 'validated' then
      raise exception 'INVENTORY_LOCKED' using errcode = '42501';
    end if;
    if TG_OP = 'DELETE' and old.status = 'validated' then
      raise exception 'INVENTORY_LOCKED' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'stock_count_lines' then
    select status into parent_status
    from public.stock_counts
    where id = case when TG_OP = 'DELETE' then old.count_id else new.count_id end;
    if parent_status = 'validated' then
      raise exception 'INVENTORY_LOCKED' using errcode = '42501';
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

revoke all on function app_private.guard_inventory_lock() from public, anon, authenticated, service_role;
