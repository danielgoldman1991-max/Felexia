-- Felexia V3 — Fix accès aux taux TVA globaux (référentiel tax_rates).
-- Contexte : la migration 20260811103000 a posé la policy RESTRICTIVE
-- active_membership_guard_v3 sur TOUTE table possédant une colonne
-- organization_id, y compris tax_rates. Or le référentiel TVA (is_system,
-- organization_id IS NULL) est GLOBAL : has_active_org_membership(NULL)
-- est toujours false -> les taux globaux sont invisibles pour toute session
-- authenticated -> select TVA vide dans l'UI, articles et lignes créés sans
-- tax_rate_id (devis "TVA -", 0,00).
-- Cette migration retire le garde RESTRICTIF sur tax_rates SEULEMENT et
-- restaure les policies de la migration 055 (lecture globale, écriture par
-- service role uniquement). Les autres tables conservent leur isolation.

-- 1) Retirer la policy restrictive issue de 20260811103000.
drop policy if exists active_membership_guard_v3 on public.tax_rates;

-- 2) Retirer l'ancienne policy permissive par-org héritée (003) si elle
--    subsiste : les taux par-org ne sont plus la source de vérité.
drop policy if exists tax_rates_org_member_all on public.tax_rates;
drop policy if exists "tax_rates_org_member_all" on public.tax_rates;

-- 3) Policies conformes au référentiel global (cohérentes avec 055) :
--    - SELECT : tous les membres authentifiés (taux globaux + par-org)
--    - INSERT/UPDATE/DELETE : réservés au service role (aucune politique)
drop policy if exists tax_rates_global_read on public.tax_rates;
create policy tax_rates_global_read on public.tax_rates
  as permissive for select to authenticated using (true);

drop policy if exists tax_rates_global_write on public.tax_rates;
create policy tax_rates_global_write on public.tax_rates
  as permissive for all to authenticated using (false) with check (false);

-- 4) Un seul taux par défaut : VAT_20 (20 %). L'état actuel marque les
--    6 taux globaux is_default = true, ce qui fait tomber les formulaires
--    sur VAT_0 (premier par sort_order).
update public.tax_rates
   set is_default = (code = 'VAT_20')
 where organization_id is null
   and is_system = true
   and code in ('VAT_0', 'VAT_7', 'VAT_10', 'VAT_14', 'VAT_20', 'VAT_EXEMPT');

-- 5) Cohérence : aucun autre is_default global.
update public.tax_rates
   set is_default = false
 where organization_id is null
   and is_system = true
   and code not in ('VAT_0', 'VAT_7', 'VAT_10', 'VAT_14', 'VAT_20', 'VAT_EXEMPT');
