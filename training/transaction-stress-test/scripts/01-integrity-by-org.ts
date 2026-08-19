/* Classification des anomalies d'intégrité PAR ORGANISATION — lecture seule.
 * Reprend la logique de scripts/audit-data-integrity.ts (totaux stockés vs sommes
 * des lignes stockées) et l'attribue à chaque org par son nom.
 * Preuves → ../database-checks/01_integrity_by_org_<ts>.txt
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MONEY_TOLERANCE = 1; // 1 centime
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

async function fetchAll(table: string, columns: string, orderCol = "id") {
  const all: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table as any)
      .select(columns)
      .order(orderCol)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    from += 1000;
  }
  return all;
}

(async () => {
  const orgs = await fetchAll("organizations", "id,name,created_at");
  const orgName = new Map<string, string>(orgs.map((o) => [o.id, o.name]));
  const byOrg: Record<string, Record<string, number>> = {};
  const bump = (orgId: string, cls: string) => {
    if (!byOrg[orgId]) byOrg[orgId] = {};
    byOrg[orgId][cls] = (byOrg[orgId][cls] ?? 0) + 1;
  };

  // Totaux documents
  const docChecks: [string, string, string, boolean][] = [
    ["customer_invoices", "customer_invoice_lines", "invoice_id", true],
    ["supplier_invoices", "supplier_invoice_lines", "invoice_id", true],
    ["sales_documents", "sales_document_lines", "document_id", false],
    ["purchase_documents", "purchase_document_lines", "document_id", true],
  ];
  for (const [headerTable, lineTable, link, hasDiscount] of docChecks) {
    const headerCols = hasDiscount
      ? "id,organization_id,status,subtotal_ht,discount_total,tax_total,total_ttc,archived_at"
      : "id,organization_id,status,subtotal_ht,tax_total,total_ttc,archived_at";
    const headers = await fetchAll(headerTable, headerCols);
    const lineCols = hasDiscount
      ? `organization_id,${link},subtotal_ht,discount_amount,tax_amount,total_ttc`
      : `organization_id,${link},subtotal_ht,tax_amount,total_ttc`;
    const lines = await fetchAll(lineTable, lineCols);
    const byParent = new Map<string, any[]>();
    for (const l of lines) {
      const k = l[link];
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(l);
    }
    for (const h of headers) {
      if (h.archived_at) continue;
      const ls = byParent.get(h.id) ?? [];
      const sum = ls.reduce(
        (a, l) => ({
          sub: a.sub + cents(l.subtotal_ht),
          disc: a.disc + cents(l.discount_amount),
          tax: a.tax + cents(l.tax_amount),
          tot: a.tot + cents(l.total_ttc),
        }),
        { sub: 0, disc: 0, tax: 0, tot: 0 },
      );
      const diffs = [
        ["subtotal_ht", cents(h.subtotal_ht), sum.sub],
        ...(hasDiscount ? [["discount_total", cents(h.discount_total), sum.disc] as const] : []),
        ["tax_total", cents(h.tax_total), sum.tax],
        ["total_ttc", cents(h.total_ttc), sum.tot],
      ].filter(([, s, c]) => Math.abs(Number(s) - Number(c)) > MONEY_TOLERANCE);
      if (diffs.length) bump(h.organization_id, `DOC_TOTAL_${headerTable}`);
    }
  }

  // Écritures déséquilibrées + totaux stockés vs lignes
  const entries = await fetchAll("accounting_entries", "id,organization_id,status,total_debit,total_credit,source_document_type,source_document_id");
  const entryLines = await fetchAll("accounting_entry_lines", "entry_id,debit,credit");
  const byEntry = new Map<string, any[]>();
  for (const l of entryLines) {
    if (!byEntry.has(l.entry_id)) byEntry.set(l.entry_id, []);
    byEntry.get(l.entry_id)!.push(l);
  }
  const invById = new Map<string, any[]>();
  for (const t of [["customer_invoices", "customer_invoice"], ["supplier_invoices", "supplier_invoice"]] as const) {
    for (const i of await fetchAll(t[0], "id,organization_id,total_ttc")) invById.set(`${t[1]}:${i.id}`, i);
  }
  for (const e of entries) {
    const ls = byEntry.get(e.id) ?? [];
    const debit = ls.reduce((a, l) => a + cents(l.debit), 0);
    const credit = ls.reduce((a, l) => a + cents(l.credit), 0);
    if (e.status === "posted" && Math.abs(debit - credit) > MONEY_TOLERANCE) bump(e.organization_id, "UNBALANCED_ENTRY");
    if (Math.abs(cents(e.total_debit) - debit) > MONEY_TOLERANCE || Math.abs(cents(e.total_credit) - credit) > MONEY_TOLERANCE)
      bump(e.organization_id, "ENTRY_TOTALS_MISMATCH");
    if (e.status === "posted" && e.source_document_type && e.source_document_id) {
      const src = invById.get(`${e.source_document_type}:${e.source_document_id}`);
      if (src && Math.abs(cents(src.total_ttc) - debit) > MONEY_TOLERANCE)
        bump(e.organization_id, "ACCT_SOURCE_TOTAL_MISMATCH");
    }
  }

  // Paiements : allocations vs disponible
  const payments = await fetchAll("customer_payments", "id,organization_id,payment_number,amount,allocated_amount,available_amount,status");
  const allocs = await fetchAll("customer_payment_allocations", "payment_id,amount,cancelled_at");
  const byPay = new Map<string, any[]>();
  for (const a of allocs) {
    if (a.cancelled_at) continue;
    if (!byPay.has(a.payment_id)) byPay.set(a.payment_id, []);
    byPay.get(a.payment_id)!.push(a);
  }
  for (const p of payments) {
    if (p.status === "cancelled") continue;
    const sum = (byPay.get(p.id) ?? []).reduce((a, l) => a + cents(l.amount), 0);
    if (Math.abs(sum - cents(p.allocated_amount)) > MONEY_TOLERANCE) bump(p.organization_id, "PAYMENT_ALLOC_MISMATCH");
    if (sum > cents(p.amount) + MONEY_TOLERANCE) bump(p.organization_id, "PAYMENT_OVERALLOCATED");
  }

  const supplierPayments = await fetchAll("supplier_payments", "id,organization_id,payment_number,amount,allocated_amount,available_amount,status");
  const supAllocs = await fetchAll("supplier_payment_allocations", "payment_id,amount,cancelled_at");
  const bySP = new Map<string, any[]>();
  for (const a of supAllocs) {
    if (a.cancelled_at) continue;
    if (!bySP.has(a.payment_id)) bySP.set(a.payment_id, []);
    bySP.get(a.payment_id)!.push(a);
  }
  for (const p of supplierPayments) {
    if (p.status === "cancelled") continue;
    const sum = (bySP.get(p.id) ?? []).reduce((a, l) => a + cents(l.amount), 0);
    if (Math.abs(sum - cents(p.allocated_amount)) > MONEY_TOLERANCE) bump(p.organization_id, "SUP_PAYMENT_ALLOC_MISMATCH");
    if (sum > cents(p.amount) + MONEY_TOLERANCE) bump(p.organization_id, "SUP_PAYMENT_OVERALLOCATED");
  }

  // Stock : current_stock vs stock_levels + vs mouvements + sans mouvement
  const products = await fetchAll("products", "id,organization_id,sku,current_stock,track_stock");
  const levels = await fetchAll("stock_levels", "organization_id,product_id,quantity", "product_id");
  const moves = await fetchAll("stock_moves", "product_id,direction,quantity");
  const byProd = new Map<string, number>();
  for (const l of levels) {
    const k = `${l.organization_id}|${l.product_id}`;
    byProd.set(k, (byProd.get(k) ?? 0) + cents(l.quantity));
  }
  const byMove = new Map<string, number>();
  for (const m of moves) {
    const k = `${m.product_id}`;
    byMove.set(k, (byMove.get(k) ?? 0) + (m.direction === "out" ? -cents(m.quantity) : cents(m.quantity)));
  }
  for (const p of products) {
    if (!p.track_stock) continue;
    const cur = cents(p.current_stock);
    const lvl = byProd.get(`${p.organization_id}|${p.id}`) ?? 0;
    const mv = byMove.get(p.id) ?? 0;
    if (Math.abs(cur - lvl) > 1) bump(p.organization_id, "STOCK_MISMATCH_products_vs_levels");
    if (Math.abs(cur - mv) > 1) bump(p.organization_id, "STOCK_MISMATCH_products_vs_moves");
    if (cur !== 0 && !byMove.has(p.id)) bump(p.organization_id, "STOCK_WITHOUT_MOVEMENT");
  }

  // Trésorerie : opening + mouvements vs current_balance
  const accounts = await fetchAll("treasury_accounts", "id,organization_id,name,opening_balance,current_balance,status");
  const tMoves = await fetchAll("treasury_transactions", "treasury_account_id,direction,amount,transaction_type,archived_at");
  const byAcc = new Map<string, { in: number; out: number }>();
  for (const m of tMoves) {
    if (m.archived_at) continue;
    if (m.transaction_type === "opening_balance") continue;
    const cur = byAcc.get(m.treasury_account_id) ?? { in: 0, out: 0 };
    if (m.direction === "in") cur.in += cents(m.amount); else cur.out += cents(m.amount);
    byAcc.set(m.treasury_account_id, cur);
  }
  for (const a of accounts) {
    if (a.status === "archived") continue;
    const m = byAcc.get(a.id) ?? { in: 0, out: 0 };
    const expected = cents(a.opening_balance) + m.in - m.out;
    if (Math.abs(expected - cents(a.current_balance)) > 1) bump(a.organization_id, "TREASURY_BALANCE_MISMATCH");
  }

  // Sortie triée par total décroissant
  const rows = Object.entries(byOrg)
    .map(([orgId, cls]) => {
      const total = Object.values(cls).reduce((a, b) => a + b, 0);
      return { orgId, name: orgName.get(orgId) ?? orgId, total, cls };
    })
    .sort((a, b) => b.total - a.total);

  const lines: string[] = [];
  let grandTotal = 0;
  for (const r of rows) {
    const detail = Object.entries(r.cls).map(([k, v]) => `${k}=${v}`).join(", ");
    grandTotal += r.total;
    lines.push(`${r.total}\t${r.name}\t${detail}`);
  }
  lines.unshift(`TOTAL anomalies classifiées par org: ${grandTotal}`);
  lines.unshift(`timestamp ${new Date().toISOString()}`);

  const out = path.resolve(process.cwd(), "training/transaction-stress-test/database-checks");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(out, `01_integrity_by_org_${ts}.txt`), lines.join("\n"), "utf8");
  console.log(lines.slice(0, 40).join("\n"));
  console.log(`\n... total orgs avec anomalies: ${rows.length}`);
  console.log(`preuve → database-checks/01_integrity_by_org_${ts}.txt`);
})().catch((e) => { console.error(e); process.exit(1); });
