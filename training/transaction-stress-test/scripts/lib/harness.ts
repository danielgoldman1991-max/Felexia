/* Harnais partagé du stress test — oracle + sessions + preuves.
 * ORACLE: reproduit à l'identique les calculs de l'app (sales-calculations.ts /
 * invoice-calculations.ts : round2 par ligne, TVA sur HT net remisé, totaux =
 * sommes arrondies) mais en centimes entiers — jamais de flottant naïf.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../../../..");
export const OUT_DIR = path.resolve(ROOT, "training/transaction-stress-test/database-checks");

export function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

export const env = loadEnv(path.join(ROOT, ".env.local"));
export const URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const PASSWORD = process.env.CAMPAIGN_PASSWORD ?? "Stress-FLX-2026#Test";
export const EMAIL = (key: string) => `stress-flx-2026-001-${key}@stress-flx-2026-001.felexia-test.local`;

export const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export async function session(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`session ${email}: ${error.message}`);
  return c;
}

export class Evidence {
  lines: string[] = [];
  ts = new Date().toISOString();
  title: string;
  filePrefix: string;
  constructor(title: string, filePrefix: string) {
    this.title = title;
    this.filePrefix = filePrefix;
    this.lines.push(`# ${title}`);
    this.lines.push(`- Généré : ${this.ts}`);
    this.lines.push(`- Tenant : stress-flx-2026-001`);
    this.lines.push("");
  }
  put(s: string) { this.lines.push(s); console.log(s); }
  section(s: string) { this.lines.push("", `## ${s}`, ""); }
  result(status: "PASS" | "FAIL" | "PARTIAL" | "BLOCKED", id: string, detail: string) {
    this.lines.push(`- [${status}] ${id} — ${detail}`);
    console.log(`[${status}] ${id} — ${detail}`);
  }
  save() {
    const file = path.join(OUT_DIR, `${this.filePrefix}_${this.ts.replace(/[:.]/g, "-")}.txt`);
    fs.writeFileSync(file, this.lines.join("\n"), "utf8");
    this.lines.push("", `→ ${path.relative(ROOT, file)}`);
    console.log(`preuve → ${path.relative(ROOT, file)}`);
  }
}

// ---------- ORACLE (centimes) ----------
export const cents = (v: unknown): number => Math.round(Number(v ?? 0) * 100);
export const MAD = (c: number): string => (c / 100).toFixed(2);

/** Ligne de document : reproduit calculateSalesLine (round2 par ligne). */
export function oracleLine(quantity: number, unitPriceHt: number, discountRate: number, taxRate: number) {
  const subUn = quantity * unitPriceHt * (1 - discountRate / 100);
  const sub = Math.round(subUn * 100) / 100;
  const tax = Math.round((subUn * taxRate / 100) * 100) / 100;
  const tot = Math.round((sub + tax) * 100) / 100;
  return { subtotal_ht: cents(sub), tax_amount: cents(tax), total_ttc: cents(tot) };
}

/** Totaux de document : somme des lignes arrondies (calculateSalesTotals). */
export function oracleTotals(lines: { subtotal_ht: number; tax_amount: number; total_ttc: number }[]) {
  const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  return {
    subtotal_ht: cents(r2(lines.reduce((a, l) => a + l.subtotal_ht / 100, 0))),
    tax_total: cents(r2(lines.reduce((a, l) => a + l.tax_amount / 100, 0))),
    total_ttc: cents(r2(lines.reduce((a, l) => a + l.total_ttc / 100, 0))),
  };
}

/** Solde restant d'une facture = total_ttc − allocations non annulées. */
export function oracleInvoiceRemaining(totalTtcCents: number, allocations: { amount: number; cancelled_at: string | null }[]) {
  const allocated = allocations.filter((a) => !a.cancelled_at).reduce((s, a) => s + cents(a.amount), 0);
  return totalTtcCents - allocated;
}

/** Trésorerie : current = opening + Σmouvements (hors type opening_balance). */
export function oracleTreasury(account: { opening_balance: number }, moves: { direction: string; amount: number; transaction_type: string }[]) {
  const sum = moves
    .filter((m) => m.transaction_type !== "opening_balance")
    .reduce((s, m) => s + (m.direction === "in" ? cents(m.amount) : -cents(m.amount)), 0);
  return cents(account.opening_balance) + sum;
}

/** Stock attendu : current = Σ entrées − sorties (moves) = Σ emplacements (levels). */
export function oracleStock(moves: { direction: string; quantity: number }[]) {
  return moves.reduce((s, m) => s + (m.direction === "in" ? m.quantity : -m.quantity), 0);
}

/** Comparaison avec tolérance 1 centime. */
export function sameMoney(a: number, b: number, tol = 1) {
  return Math.abs(a - b) <= tol;
}
