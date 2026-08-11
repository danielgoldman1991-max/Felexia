-- Felexia V3 fix : les guards de permission par nom de rôle cassent l'application.
-- L'app n'utilise pas requirePermission() : tout membre actif peut créer/modifier
-- des articles, ajuster le stock et gérer la trésorerie. Les policies restrictives
-- *_guard_v3 exigent des noms de rôles codés en dur (owner/admin/manager/stock/...)
-- et rejettent les rôles réels (sales, commercial, stock_user, rôles personnalisés).
--
-- L'isolation tenant est déjà assurée par active_membership_guard_v3 (migration
-- 20260811103000), posée sur toutes les tables org avec has_active_org_membership().
-- On supprime donc les guards par permission redondants ; on conserve les guards
-- d'intégrité `using (false)` (immutabilité des mouvements/niveaux de stock).

-- ── Products : la création d'article est ouverte à tout membre actif ──────────
drop policy if exists products_insert_guard_v3 on public.products;
drop policy if exists products_update_guard_v3 on public.products;
drop policy if exists products_delete_guard_v3 on public.products;

-- ── Stock : insertion libre pour tout membre actif (écriture via RPC atomique),
--    l'immutabilité des mouvements reste protégée par les guards `using (false)`. ─
drop policy if exists stock_moves_insert_guard_v3 on public.stock_moves;
drop policy if exists stock_levels_insert_guard_v3 on public.stock_levels;
drop policy if exists stock_levels_update_guard_v3 on public.stock_levels;

-- ── Trésorerie : paiements, comptes et transactions pour tout membre actif ─────
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'customer_payments',
    'customer_payment_allocations',
    'supplier_payments',
    'supplier_payment_allocations',
    'treasury_accounts',
    'treasury_transactions'
  ]
  loop
    if to_regclass('public.' || target_table) is null then continue; end if;
    execute format('drop policy if exists financial_insert_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists financial_update_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists financial_delete_guard_v3 on public.%I', target_table);
  end loop;
end;
$$;

-- ── Rapprochement bancaire : tout membre actif ─────────────────────────────────
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'bank_statement_imports',
    'bank_statement_lines',
    'bank_reconciliations'
  ]
  loop
    if to_regclass('public.' || target_table) is null then continue; end if;
    execute format('drop policy if exists reconciliation_insert_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists reconciliation_update_guard_v3 on public.%I', target_table);
    execute format('drop policy if exists reconciliation_delete_guard_v3 on public.%I', target_table);
  end loop;
end;
$$;
