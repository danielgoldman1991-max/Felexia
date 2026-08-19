/* Vérification du tenant de campagne : intégrité 0/0/0 + sessions RLS réelles.
 * - Exécute les mêmes invariants que 01-integrity-by-org sur le tenant de campagne uniquement.
 * - Prouve la connexion (signInWithPassword) de owner, sales, auditor, suspended.
 * - Prouve l'isolation RLS : le membre suspendu ne voit pas les données de l'org.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.resolve(ROOT, "training/transaction-stress-test/database-checks");

function loadEnv(file: string): Record<string, string> {
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

const env = loadEnv(path.join(ROOT, ".env.local"));
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = process.env.CAMPAIGN_PASSWORD ?? "Stress-FLX-2026#Test";
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

(async () => {
  const log: string[] = [];
  const put = (s: string) => { log.push(s); console.log(s); };

  const { data: org } = await admin.from("organizations" as any).select("id,name,slug").eq("slug", "stress-flx-2026-001").single();
  const orgId = org.id;
  put(`Org: ${org.name} (${orgId})`);

  // --- Intégrité tenant campagne : 8 invariants ---
  const issues: string[] = [];
  const checks: [string, string, string][] = [
    ["customer_invoices", "customer_invoice_lines", "invoice_id"],
    ["supplier_invoices", "supplier_invoice_lines", "invoice_id"],
    ["sales_documents", "sales_document_lines", "document_id"],
    ["purchase_documents", "purchase_document_lines", "document_id"],
  ];
  for (const [ht, lt, link] of checks) {
    const { data: headers } = await admin.from(ht as any).select("id,status,subtotal_ht,discount_total,tax_total,total_ttc,archived_at").eq("organization_id", orgId);
    const { data: lines } = await admin.from(lt as any).select(`${link},subtotal_ht,discount_amount,tax_amount,total_ttc`);
    const byP = new Map<string, any[]>();
    for (const l of lines ?? []) { if (!byP.has(l[link])) byP.set(l[link], []); byP.get(l[link])!.push(l); }
    for (const h of headers ?? []) {
      if (h.archived_at) continue;
      const ls = byP.get(h.id) ?? [];
      const sum = ls.reduce((a, l) => ({ s: a.s + cents(l.subtotal_ht), d: a.d + cents(l.discount_amount ?? 0), t: a.t + cents(l.tax_amount), o: a.o + cents(l.total_ttc) }), { s: 0, d: 0, t: 0, o: 0 });
      const diffs = [
        ["subtotal_ht", cents(h.subtotal_ht), sum.s],
        ...(ht !== "sales_documents" ? [["discount_total", cents(h.discount_total ?? 0), sum.d] as const] : []),
        ["tax_total", cents(h.tax_total), sum.t],
        ["total_ttc", cents(h.total_ttc), sum.o],
      ].filter(([, a, b]) => Math.abs(Number(a) - Number(b)) > 1);
      if (diffs.length) issues.push(`DOC_TOTAL_${ht} ${h.id} ${JSON.stringify(diffs)}`);
    }
  }
  const { data: products } = await admin.from("products" as any).select("id,current_stock,track_stock").eq("organization_id", orgId);
  const { data: levels } = await admin.from("stock_levels" as any).select("product_id,quantity").eq("organization_id", orgId);
  const lvl = new Map<string, number>();
  for (const l of levels ?? []) lvl.set(l.product_id, (lvl.get(l.product_id) ?? 0) + cents(l.quantity));
  for (const p of products ?? []) {
    if (!p.track_stock) continue;
    const cur = cents(p.current_stock);
    if (cur !== (lvl.get(p.id) ?? 0)) issues.push(`STOCK ${p.id} current=${cur} levels=${lvl.get(p.id) ?? 0}`);
  }
  const { data: accs } = await admin.from("treasury_accounts" as any).select("id,opening_balance,current_balance,status").eq("organization_id", orgId);
  const { data: tmoves } = await admin.from("treasury_transactions" as any).select("treasury_account_id,direction,amount,transaction_type,archived_at").eq("organization_id", orgId);
  const mSum = new Map<string, number>();
  for (const m of tmoves ?? []) {
    if (m.archived_at || m.transaction_type === "opening_balance") continue;
    mSum.set(m.treasury_account_id, (mSum.get(m.treasury_account_id) ?? 0) + (m.direction === "in" ? cents(m.amount) : -cents(m.amount)));
  }
  for (const a of accs ?? []) {
    if (a.status === "archived") continue;
    const expected = cents(a.opening_balance) + (mSum.get(a.id) ?? 0);
    if (expected !== cents(a.current_balance)) issues.push(`TREASURY ${a.id} expected=${expected} current=${cents(a.current_balance)}`);
  }
  const { data: entries } = await admin.from("accounting_entries" as any).select("id,status,total_debit,total_credit").eq("organization_id", orgId);
  const { data: elines } = await admin.from("accounting_entry_lines" as any).select("entry_id,debit,credit").eq("organization_id", orgId);
  const eSum = new Map<string, { d: number; c: number }>();
  for (const l of elines ?? []) { const cur = eSum.get(l.entry_id) ?? { d: 0, c: 0 }; cur.d += cents(l.debit); cur.c += cents(l.credit); eSum.set(l.entry_id, cur); }
  for (const e of entries ?? []) {
    const s = eSum.get(e.id) ?? { d: 0, c: 0 };
    if (e.status === "posted" && s.d !== s.c) issues.push(`UNBALANCED ${e.id} d=${s.d} c=${s.c}`);
    if (s.d !== cents(e.total_debit) || s.c !== cents(e.total_credit)) issues.push(`ENTRY_HEADER ${e.id}`);
  }
  put(`Intégrité tenant campagne : ${issues.length === 0 ? "0 anomalie" : issues.join("\n")}`);
  if (issues.length) { console.error("ABANDON: tenant non intègre avant tests"); process.exit(1); }

  // --- Sessions RLS ---
  const session = async (email: string) => {
    const c = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.session) return { ok: false, error: error?.message ?? "no session", client: c };
    return { ok: true, client: c };
  };
  const roles: Record<string, string> = { owner: "owner", sales: "sales", auditor: "viewer", suspended: "viewer" };
  for (const [key, roleName] of Object.entries(roles)) {
    const s = await session(`stress-flx-2026-001-${key}@stress-flx-2026-001.felexia-test.local`);
    if (!s.ok) { put(`[session ${key}] ÉCHEC: ${s.error}`); issues.push(`SESSION_${key}`); continue; }
    const { data: rows } = await s.client.from("sales_documents" as any).select("id").limit(1);
    const { data: orgs } = await s.client.from("organizations" as any).select("id").limit(10);
    put(`[session ${key}] connexion OK, sales_documents visibles=${rows?.length ?? 0}, orgs visibles=${orgs?.length ?? 0}`);
  }

  // --- Isolation: suspended (status disabled) ne doit PAS lire la comptabilité de l'org ---
  const susp = await session(`stress-flx-2026-001-suspended@stress-flx-2026-001.felexia-test.local`);
  if (susp.ok) {
    const { data: ent } = await susp.client.from("accounting_entries" as any).select("id").eq("organization_id", orgId).limit(1);
    const { data: cus } = await susp.client.from("third_parties" as any).select("id").eq("organization_id", orgId).limit(1);
    put(`[isolation] suspended voit accounting=${ent?.length ?? 0} tiers=${cus?.length ?? 0} (attendu 0/0)`);
    if ((ent?.length ?? 0) > 0 || (cus?.length ?? 0) > 0) issues.push("RLS_SUSPENDED_LEAK");
  }
  // Auditor (viewer actif) peut LIRE mais pas écrire
  const aud = await session(`stress-flx-2026-001-auditor@stress-flx-2026-001.felexia-test.local`);
  if (aud.ok) {
    const { data: vis, error: readErr } = await aud.client.from("third_parties" as any).select("id").eq("organization_id", orgId).limit(1);
    const { error: writeErr } = await aud.client.from("third_parties" as any).insert({ organization_id: orgId, name: "STRESS-X" });
    put(`[isolation] viewer lit=${vis?.length ?? 0} (err=${readErr?.message ?? "aucune"}), écriture interdite=${writeErr ? "OUI" : "NON (FUITE)"}`);
    if (writeErr === null) issues.push("RLS_VIEWER_WRITE");
  }

  put(issues.length ? `\nISSUES: ${issues.join(", ")}` : "\nTOUTES LES VÉRIFICATIONS PASSENT");
  fs.writeFileSync(path.join(OUT, `04_verify_tenant_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`), log.join("\n"), "utf8");
})().catch((e) => { console.error(e); process.exit(1); });
