# Stress test transactionnel FelexiaERP — Rapport de synthèse

> Tenant de campagne isolé `stress-flx-2026-001` (ATLAS DISTRIBUTION & SERVICES TEST SARL AU) — données 100 % fictives `STRESS-*`.
> Preuves : `training/transaction-stress-test/database-checks/` (fichiers `NN_scenario_*_UTC.txt` + `resume_resultats.csv`).

## Résultat global

- **63 checks PASS** — **1 PARTIAL** (finding documenté) — **0 FAIL/BLOCKED**
- Scénarios A (achats), B (ventes), C (métamorphique), D (concurrence), E (permissions), F (charge) : **tous verts**.
- F0 « numérotation parallèle » : PARTIAL **attendu** — mesure volontaire du finding n° 1 (14/30 échecs d'unicité au batch de 10).
- Audit d'intégrité final (8 invariants, toutes tables, tous tenants) : TOTAL anomalies classifiées par org: 1567.

## Performance (tenant de campagne, run canonique 2026-08-11T13:10Z)

| Lot (10 inserts) | Documents | Échecs | Latence médiane/lot | Max |
| --- | --- | --- | --- | --- |
| F1 commandes ×2 lignes | 200 | 0 | 300 ms | 604 ms |
| F2 factures client | 200 | 0 | 203 ms | 223 ms |
| F3 factures fournisseur | 100 | 0 | 203 ms | 219 ms |
| F4 paiements client (RPC) | 50 | 0 | 400 ms | 551 ms |
| F4 paiements fournisseur (RPC) | 50 | 0 | — | — |
| F5 réceptions stock (RPC) | 50 | 0 | 439 ms | 733 ms |

- Oracle final : **trésorerie 56 349.84 MAD** (= 53 849.84 + flux net F4 2 500.00), **stock 58** = niveaux 58 = oracle, **0 doublon de numéro** (sales_documents / customer_invoices / supplier_invoices).

## Findings (constats documentés, aucun correctif applicatif appliqué)

1. **Numérotation parallèle non verrouillée** — les triggers de génération de numéro de `sales_documents` et `purchase_documents` utilisent `SELECT max(numéro)+1` sans verrou : 2 insertions simultanées produisent le même numéro → violation d'unicité (D4/D5/F0). Les factures client/fournisseur utilisent `numbering_sequences` (`FOR UPDATE`) → sûres. **Impact** : les bonnes pratiques de finalisation par l'UI (flux séquentiels) cachent le risque ; une écriture directe parallèle peut échouer. Préconisation : même mécanisme `numbering_sequences` que les factures.
2. **Rôle `stock_user` exclu de `has_org_permission('stock.%')`** — la liste autorisée (manager/responsable/gestionnaire/stock/magasinier) n'inclut pas le rôle seedé `stock_user` : un magasinier ne peut pas finaliser de réception via `record_stock_movements_atomic` (E2). **Impact** : les équipes entrepôt bloquées en attendant l'ajout du rôle à la liste.
3. **Politiques RLS des documents = simple appartenance d'org** — tout membre actif (même `viewer`) peut écrire les tables documents (E5) ; la granularité réelle ne vit que dans les RPC trésorerie/stock. **Impact** : conforme au contrat actuel (« membres actifs »), mais toute écriture directe (API PostgREST) contourne les permissions métier.
4. **Message trompeur sur refus trésorerie non autorisé** — un rôle sans permission de trésorerie reçoit « Compte de trésorerie introuvable ou inactif. » au lieu d'un refus de permission (E1/E2/E5). **Impact** : diagnostic utilisateur déroutant.

## Garanties vérifiées

- **Idempotence** : rejeu paiement et rejeu stock (même clé) → `replayed=true`, aucune double écriture (C4/C5, D1, D3).
- **Invariants financiers** : totaux = Σ lignes arrondies (round2), surpaiement refusé (« La facture client serait sur-réglée. »), dette zéro après règlement complet, trésorerie = opening + Σ mouvements.
- **Invariants stock** : stock négatif refusé (« Stock insuffisant dans cet emplacement. »), stock = Σ mouvements = niveaux, allocations source obligatoires, livraison partielle au-delà du stock impossible (D5).
- **Permissions** : paiements/stock refusés aux rôles non autorisés (sales, stock_user, viewer), isolations suspended/outsider à 0 ligne, comptable + manager opérationnels.
- **Intégrité finale** : 0 anomalie sur le tenant de campagne après 850+ documents et 450+ écritures concurrentes ; les 3 tenants réels restent dans leur état connu (1567 anomalies classifiées, inchangées).

## Réexécution

1. Reset + seed : `$env:RESET_CAMPAIGN="true"; npx tsx training/transaction-stress-test/scripts/03-seed-campaign-tenant.ts`
2. Scénarios séquentiels : `node --experimental-strip-types training/transaction-stress-test/scripts/10-scenario-purchase.ts` → `11` → `12` → `13` → `14` → `15`
3. Audit final : `node --experimental-strip-types training/transaction-stress-test/scripts/01-integrity-by-org.ts`
4. Export : `node --experimental-strip-types training/transaction-stress-test/scripts/16-export-livrable.ts`
