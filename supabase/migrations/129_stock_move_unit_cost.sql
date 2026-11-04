-- 129: coût unitaire des mouvements de stock (CMUP).
-- Additive. Existing rows stay NULL and keep the previous valuation fallback.
--
-- Rollback: supabase/rollbacks/129_stock_move_unit_cost_rollback.sql

alter table public.stock_moves
  add column if not exists unit_cost numeric(14, 4) null;
