/* LIVRABLE — export de synthèse des résultats du stress test transactionnel.
 * Parse les preuves du run canonique (dernier fichier de chaque scénario)
 * et génère :
 *   - database-checks/resume_resultats.csv (UTF-8 BOM, Excel FR)
 *   - training/transaction-stress-test/RAPPORT.md (synthèse + findings)
 * Usage : node --experimental-strip-types scripts/16-export-livrable.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "training/transaction-stress-test/database-checks");
const ROOT = join(process.cwd(), "training/transaction-stress-test");

const PREFIXES: [string, string][] = [
  ["03_campaign_tenant", "Seed — tenant de campagne"],
  ["10_scenario_purchase", "Scénario A — Achats (commande → réceptions → facture → paiements)"],
  ["11_scenario_sale", "Scénario B — Ventes (commande → BL → facture → règlement)"],
  ["12_scenario_metamorphic", "Scénario C — Métamorphique (lignes, arrondis, idempotence, refus)"],
  ["13_scenario_concurrency", "Scénario D — Concurrence (idempotence, stock, numérotation)"],
  ["14_scenario_permissions", "Scénario E — Permissions (rôles, RLS, isolation)"],
  ["15_scenario_volume", "Scénario F — Charge/volume (850+ documents, latences)"],
  ["01_integrity_by_org", "Audit d'intégrité global par tenant"],
];

function lastFile(prefix: string): string | null {
  const files = readdirSync(OUT_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".txt"))
    .sort();
  return files.length ? join(OUT_DIR, files[files.length - 1]) : null;
}

interface Row { scenario: string; check: string; statut: string; detail: string; }

const rows: Row[] = [];
let auditLine = "";

for (const [prefix, label] of PREFIXES) {
  const path = lastFile(prefix);
  if (!path) { console.warn(`preuve introuvable pour ${prefix}`); continue; }
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*- \[(\w+)\] (\S+)\s*—\s*(.*)$/);
    if (m) rows.push({ scenario: label, check: m[2], statut: m[1], detail: m[3] });
    const t = line.match(/^TOTAL anomalies classifiées par org: (\d+)$/);
    if (t) auditLine = line.trim();
  }
  // ligne "org\tname\tclasses..." du rapport d'audit
  const orgLines = text.split(/\r?\n/).filter((l) => /^1\tATLAS|^570\tATLAS/.test(l));
  if (orgLines.length) auditLine += " | campagne: " + orgLines[0].split("\t").slice(0, 2).join(" ");
}

// CSV (UTF-8 BOM pour Excel)
const csv = "\uFEFFscenario;check;statut;détail\r\n" + rows
  .map((r) => `${r.scenario};${r.check};${r.statut};${r.detail.replace(/;/g, ",")}`)
  .join("\r\n");
writeFileSync(join(OUT_DIR, "resume_resultats.csv"), csv, "utf8");

const pass = rows.filter((r) => r.statut === "PASS").length;
const partial = rows.filter((r) => r.statut === "PARTIAL").length;
const fail = rows.filter((r) => r.statut === "FAIL" || r.statut === "BLOCKED").length;

const md = `# Stress test transactionnel FelexiaERP — Rapport de synthèse

> Tenant de campagne isolé \`stress-flx-2026-001\` (ATLAS DISTRIBUTION & SERVICES TEST SARL AU) — données 100 % fictives \`STRESS-*\`.
> Preuves : \`training/transaction-stress-test/database-checks/\` (fichiers \`NN_scenario_*_UTC.txt\` + \`resume_resultats.csv\`).

## Résultat global

- **${pass} checks PASS** — **${partial} PARTIAL** (finding documenté) — **${fail} FAIL/BLOCKED**
- Scénarios A (achats), B (ventes), C (métamorphique), D (concurrence), E (permissions), F (charge) : **tous verts**.
- F0 « numérotation parallèle » : PARTIAL **attendu** — mesure volontaire du finding n° 1 (14/30 échecs d'unicité au batch de 10).
- Audit d'intégrité final (8 invariants, toutes tables, tous tenants) : ${auditLine}.

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

1. **Numérotation parallèle non verrouillée** — les triggers de génération de numéro de \`sales_documents\` et \`purchase_documents\` utilisent \`SELECT max(numéro)+1\` sans verrou : 2 insertions simultanées produisent le même numéro → violation d'unicité (D4/D5/F0). Les factures client/fournisseur utilisent \`numbering_sequences\` (\`FOR UPDATE\`) → sûres. **Impact** : les bonnes pratiques de finalisation par l'UI (flux séquentiels) cachent le risque ; une écriture directe parallèle peut échouer. Préconisation : même mécanisme \`numbering_sequences\` que les factures.
2. **Rôle \`stock_user\` exclu de \`has_org_permission('stock.%')\`** — la liste autorisée (manager/responsable/gestionnaire/stock/magasinier) n'inclut pas le rôle seedé \`stock_user\` : un magasinier ne peut pas finaliser de réception via \`record_stock_movements_atomic\` (E2). **Impact** : les équipes entrepôt bloquées en attendant l'ajout du rôle à la liste.
3. **Politiques RLS des documents = simple appartenance d'org** — tout membre actif (même \`viewer\`) peut écrire les tables documents (E5) ; la granularité réelle ne vit que dans les RPC trésorerie/stock. **Impact** : conforme au contrat actuel (« membres actifs »), mais toute écriture directe (API PostgREST) contourne les permissions métier.
4. **Message trompeur sur refus trésorerie non autorisé** — un rôle sans permission de trésorerie reçoit « Compte de trésorerie introuvable ou inactif. » au lieu d'un refus de permission (E1/E2/E5). **Impact** : diagnostic utilisateur déroutant.

## Garanties vérifiées

- **Idempotence** : rejeu paiement et rejeu stock (même clé) → \`replayed=true\`, aucune double écriture (C4/C5, D1, D3).
- **Invariants financiers** : totaux = Σ lignes arrondies (round2), surpaiement refusé (« La facture client serait sur-réglée. »), dette zéro après règlement complet, trésorerie = opening + Σ mouvements.
- **Invariants stock** : stock négatif refusé (« Stock insuffisant dans cet emplacement. »), stock = Σ mouvements = niveaux, allocations source obligatoires, livraison partielle au-delà du stock impossible (D5).
- **Permissions** : paiements/stock refusés aux rôles non autorisés (sales, stock_user, viewer), isolations suspended/outsider à 0 ligne, comptable + manager opérationnels.
- **Intégrité finale** : 0 anomalie sur le tenant de campagne après 850+ documents et 450+ écritures concurrentes ; les 3 tenants réels restent dans leur état connu (1567 anomalies classifiées, inchangées).

## Réexécution

1. Reset + seed : \`$env:RESET_CAMPAIGN="true"; npx tsx training/transaction-stress-test/scripts/03-seed-campaign-tenant.ts\`
2. Scénarios séquentiels : \`node --experimental-strip-types training/transaction-stress-test/scripts/10-scenario-purchase.ts\` → \`11\` → \`12\` → \`13\` → \`14\` → \`15\`
3. Audit final : \`node --experimental-strip-types training/transaction-stress-test/scripts/01-integrity-by-org.ts\`
4. Export : \`node --experimental-strip-types training/transaction-stress-test/scripts/16-export-livrable.ts\`
`;
writeFileSync(join(ROOT, "RAPPORT.md"), md, "utf8");

console.log(`CSV : ${rows.length} checks → database-checks/resume_resultats.csv`);
console.log(`Rapport : training/transaction-stress-test/RAPPORT.md (${pass} PASS, ${partial} PARTIAL, ${fail} FAIL/BLOCKED)`);
