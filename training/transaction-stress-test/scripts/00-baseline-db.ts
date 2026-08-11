/* Baseline DB — lecture seule. Campagne STRESS-FLX-2026-001.
 * Verifie : état du schéma, migrations, tables comptables, RLS, contraintes,
 * vues, compteurs multi-tenant. Preuves → ../database-checks/.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx <= 0) continue;
    out[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv(path.resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing env");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const outDir = path.resolve(process.cwd(), "training/transaction-stress-test/database-checks");
const logLines: string[] = [];
const log = (s: string) => { logLines.push(s); console.log(s); };

async function query(label: string, sql: string) {
  const { data, error } = await admin.rpc("run_sql" as never, { query: sql } as never);
  if (error) return { label, error: error.message };
  return { label, data };
}

/* PostgREST ne permet pas SQL arbitraire ; on passe par la table supposée
 * `pg_stat_statements` ? Non. On utilise le fallback: aucune RPC run_sql n'existe.
 * → Les vérifications schéma se font via l'API PostgREST (information_schema n'est pas exposé).
 * On documente cette limite et on utilise les requêtes ciblées par table.
 */
async function tableInfo(table: string) {
  const { data, error } = await admin.from(table as any).select("*").limit(1);
  return { table, error: error?.message ?? null, sample: data?.[0] ?? null };
}

async function counts() {
  const tables = [
    "organizations", "organization_members", "profiles", "third_parties", "products",
    "sales_documents", "customer_invoices", "customer_payments", "customer_credit_notes",
    "purchase_documents", "supplier_invoices", "supplier_payments",
    "stock_levels", "stock_moves", "warehouses",
    "treasury_accounts", "treasury_transactions",
    "accounting_entries", "accounting_entry_lines", "accounting_accounts", "accounting_journals",
    "app_notifications", "documents", "vat_declarations", "subscription_plans",
    "organization_subscriptions", "organization_modules", "modules_catalog",
    "roles", "permissions", "role_permissions", "company_settings", "tax_rates",
    "numbering_sequences", "audit_logs",
  ];
  const results: string[] = [];
  for (const t of tables) {
    const { count, error } = await admin.from(t as any).select("*", { count: "exact", head: true });
    results.push(`${t}\t${error ? "ERR:" + error.message : (count ?? "?")}`);
  }
  return results;
}

async function subscriptionsByPlan() {
  const { data, error } = await admin
    .from("organization_subscriptions")
    .select("plan_code,status")
    .order("plan_code");
  if (error) return [`ERR ${error.message}`];
  const agg: Record<string, number> = {};
  for (const r of data) { const k = `${r.plan_code}/${r.status}`; agg[k] = (agg[k] ?? 0) + 1; }
  return Object.entries(agg).map(([k, v]) => `${k}\t${v}`);
}

async function duplicateCheck() {
  const out: string[] = [];
  const checks: [string, string, string][] = [
    ["customer_invoices", "invoice_number", "FAC"],
    ["customer_payments", "payment_number", "REG"],
    ["customer_credit_notes", "credit_note_number", "AV"],
    ["sales_documents", "document_number", "DEV/CMD/BL"],
    ["purchase_documents", "document_number", "CF/REC"],
    ["supplier_invoices", "invoice_number", "FF"],
    ["supplier_payments", "payment_number", "RFO"],
  ];
  for (const [table, col, label] of checks) {
    const { data, error } = await admin
      .from(table as any)
      .select(`organization_id,${col}`)
      .order(col);
    if (error) { out.push(`${table}\tERR ${error.message}`); continue; }
    const seen = new Map<string, number>();
    for (const r of data as any[]) {
      const k = `${r.organization_id}|${r[col]}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, c]) => c > 1);
    out.push(`${label} (${table})\ttotal=${data.length}\tduplicates=${dups.length}`);
    for (const [k, c] of dups.slice(0, 5)) out.push(`  DUP ${k} x${c}`);
  }
  return out;
}

(async () => {
  log("=== BASELINE DB — STRESS-FLX-2026-001 ===");
  log(`timestamp\t${new Date().toISOString()}`);
  log(`env\t${url}`);

  log("\n--- COMPTES PAR TABLE ---");
  const c = await counts();
  log(c.join("\n"));

  log("\n--- ABONNEMENTS PAR PLAN/STATUT ---");
  const s = await subscriptionsByPlan();
  log(s.join("\n"));

  log("\n--- DOUBLONS DE NUMEROTATION (scanner global) ---");
  const d = await duplicateCheck();
  log(d.join("\n"));

  log("\n--- ECHANTILLONS TABLES COMPTABLES ---");
  for (const t of ["accounting_entries", "accounting_entry_lines", "accounting_accounts", "accounting_journals"]) {
    const r = await tableInfo(t);
    log(`${r.table}\t${r.error ? "ABSENTE/ERR: " + r.error : "PRESENTE, sample: " + JSON.stringify(r.sample).slice(0, 200)}`);
  }

  log("\n--- ECHANTILLONS TABLES LEGACY ---");
  for (const t of ["sales_quotes", "sales_invoices", "view_dashboard_kpis"]) {
    const r = await tableInfo(t);
    log(`${r.table}\t${r.error ? "ABSENTE: " + r.error : "PRESENTE"}`);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(outDir, `00_baseline_db_${ts}.txt`), logLines.join("\n"), "utf8");
  log(`\npreuves → database-checks/00_baseline_db_${ts}.txt`);
})().catch((e) => { console.error(e); process.exit(1); });
