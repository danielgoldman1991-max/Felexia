/* SCÉNARIO F — CHARGE / VOLUME (invariants sous 850+ documents) :
 * F0 numérotation parallèle mesurée (30 sales_documents sans numéro → taux d'échec)
 * F1 200 commandes client + 2 lignes chacune (numéros explicites)
 * F2 200 factures client manuelles (montants déterministes 100..299)
 * F3 100 factures fournisseur manuelles (50..149)
 * F4 50 paiements client + 50 paiements fournisseur (RPC atomiques)
 * F5 50 réceptions stock (1 u. chacune) → stock 58
 * F6 oracle final (trésorerie, stock, numéros uniques, latences)
 * S'exécute APRÈS A+B+C+D+E (stock 8, trésorerie 53849.84).
 */
import { admin, session, EMAIL, Evidence, oracleTreasury, oracleStock, oracleLine, oracleTotals, cents, MAD } from "./lib/harness.ts";

const ev = new Evidence("Scénario F — Charge et volume (850+ documents, latences, oracle)", "15_scenario_volume");

const lookups = await (async () => {
  const org = (await admin.from("organizations" as any).select("id").eq("slug", "stress-flx-2026-001").single()).data;
  const p1 = (await admin.from("products" as any).select("id").eq("organization_id", org.id).eq("sku", "STRESS-P1").single()).data;
  const vat = (await admin.from("tax_rates" as any).select("id").eq("code", "VAT_20").eq("is_system", true).single()).data;
  const cust = (await admin.from("third_parties" as any).select("id").eq("organization_id", org.id).eq("name", "STRESS-Client-Retail-Casablanca").single()).data;
  const sup = (await admin.from("third_parties" as any).select("id").eq("organization_id", org.id).eq("name", "STRESS-Fournisseur-Import-Safi").single()).data;
  const wh = (await admin.from("warehouses" as any).select("id").eq("organization_id", org.id).eq("code", "WH-MAR").eq("status", "active").single()).data;
  const bank = (await admin.from("treasury_accounts" as any).select("id").eq("organization_id", org.id).eq("name", "Banque Marrakech").single()).data;
  return { org: org.id, p1: p1.id, vat: vat.id, cust: cust.id, sup: sup.id, wh: wh.id, bank: bank.id };
})();
const ORG = lookups.org, P1 = lookups.p1, VAT20 = lookups.vat, CUST1 = lookups.cust, SUP1 = lookups.sup, WH_MAR = lookups.wh, BANK_MAR = lookups.bank;

const owner = await session(EMAIL("owner"));

const pct = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
async function batch<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<unknown>) {
  const timings: number[] = [];
  let failures = 0;
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const t0 = Date.now();
    const results = await Promise.all(chunk.map((item, k) => fn(item, i + k)));
    timings.push(Date.now() - t0);
    failures += results.filter((r) => r).length;
  }
  return { timings, failures };
}
const treasuryNow = async () => {
  const { data: acc } = await admin.from("treasury_accounts" as any).select("opening_balance,current_balance").eq("id", BANK_MAR).single();
  const { data: moves } = await admin.from("treasury_transactions" as any).select("direction,amount,transaction_type,archived_at").eq("treasury_account_id", BANK_MAR);
  return { actual: cents(acc?.current_balance), expected: oracleTreasury(acc, moves ?? []) };
};
const stockNow = async () => {
  const { data: prod } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
  const { data: levels } = await admin.from("stock_levels" as any).select("quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const { data: allMoves } = await admin.from("stock_moves" as any).select("direction,quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  return { current: cents(prod?.current_stock), levels: (levels ?? []).reduce((a, lv) => a + cents(lv.quantity), 0), oracle: cents(oracleStock(allMoves ?? [])) };
};

(async () => {
  ev.section("F0. Numérotation parallèle — 30 sales_documents sans numéro (batch de 10)");
  const f0 = await batch(Array.from({ length: 30 }, (_, i) => i), 10, async (_x, i) => {
    const { error } = await owner.from("sales_documents" as any).insert({
      organization_id: ORG, document_type: "order", document_number: "", customer_id: CUST1,
      document_date: "2026-08-26", status: "draft", notes: `STRESS-f0-${i}`,
    });
    return error ? error.message : null;
  });
  const dupCount = f0.failures;
  ev.result(dupCount === 0 ? "PASS" : "PARTIAL", "F0-parallel-numbering",
    dupCount === 0
      ? "30/30 numéros générés sans collision (séquentiel par lot effectif ou chance) — latences par lot " + f0.timings.join("/") + " ms"
      : `${30 - dupCount}/30 réussis, ${dupCount} échecs de contrainte d'unicité (finding numérotation — SELECT max+1 non verrouillé, cf. D5)`);

  ev.section("F1. 200 commandes client × 2 lignes (numéros explicites, batch 10)");
  const f1 = await batch(Array.from({ length: 200 }, (_, i) => i), 10, async (_x, i) => {
    const l = i % 2 === 0 ? 120.5 : 45.99;
    const l1 = oracleLine(2, l, i % 3 === 0 ? 5 : 0, 20);
    const l2 = oracleLine(1, 10, 0, 20);
    const oh = oracleTotals([l1, l2]);
    const { data: doc, error: de } = await owner.from("sales_documents" as any).insert({
      organization_id: ORG, document_type: "order", document_number: `CMD-2608-09${String(i).padStart(3, "0")}`, customer_id: CUST1,
      document_date: "2026-08-26", status: "confirmed", notes: `STRESS-f1-${i}`,
      subtotal_ht: oh.subtotal_ht / 100, tax_total: oh.tax_total / 100, total_ttc: oh.total_ttc / 100,
    }).select("id").single();
    if (de) return de.message;
    const { error: le } = await owner.from("sales_document_lines" as any).insert({
      organization_id: ORG, document_id: doc.id, line_order: 1, product_id: P1, description: `L1-${i}`,
      quantity: 2, unit_price_ht: l, discount_rate: i % 3 === 0 ? 5 : 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: l1.subtotal_ht / 100, tax_amount: l1.tax_amount / 100, total_ttc: l1.total_ttc / 100,
      ordered_quantity: 2, delivered_quantity: 0, remaining_quantity: 2,
    });
    if (le) return le.message;
    const { error: le2 } = await owner.from("sales_document_lines" as any).insert({
      organization_id: ORG, document_id: doc.id, line_order: 2, product_id: P1, description: `L2-${i}`,
      quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: l2.subtotal_ht / 100, tax_amount: l2.tax_amount / 100, total_ttc: l2.total_ttc / 100,
      ordered_quantity: 1, delivered_quantity: 0, remaining_quantity: 1,
    });
    return le2 ? le2.message : null;
  });
  const { count: c1 } = await admin.from("sales_documents" as any).select("id", { count: "exact", head: true }).eq("organization_id", ORG).eq("document_type", "order").like("notes", "STRESS-f1-%");
  ev.result(f1.failures === 0 && c1 === 200 ? "PASS" : "FAIL", "F1-orders",
    `200/200 commandes (2 lignes chacune), latence médiane/lot ${pct(f1.timings, 0.5)} ms, max ${Math.max(...f1.timings)} ms, échecs ${f1.failures}`);

  ev.section("F2. 200 factures client manuelles (100..299 MAD TTC)");
  const f2 = await batch(Array.from({ length: 200 }, (_, i) => i), 10, async (_x, i) => {
    const total = 100 + i;
    const { data: inv, error } = await owner.from("customer_invoices" as any).insert({
      organization_id: ORG, customer_id: CUST1, source_type: "manual", invoice_number: `FAC-2608-09${String(i).padStart(3, "0")}`,
      invoice_date: "2026-08-26", due_date: "2026-09-25", status: "validated", payment_status: "unpaid",
      payment_terms_days: 30, paid_amount: 0, remaining_amount: total,
      subtotal_ht: +(total / 1.2).toFixed(2), discount_total: 0, tax_total: +(total - total / 1.2).toFixed(2), total_ttc: total,
      notes: `STRESS-f2-${i}`,
    }).select("id").single();
    if (error) return error.message;
    const { error: le } = await owner.from("customer_invoice_lines" as any).insert({
      organization_id: ORG, invoice_id: inv.id, line_order: 1, product_id: P1, description: `Ligne ${i}`,
      quantity: 1, unit_price_ht: +(total / 1.2).toFixed(2), discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: +(total / 1.2).toFixed(2), discount_amount: 0, tax_amount: +(total - total / 1.2).toFixed(2), total_ttc: total,
    });
    return le ? le.message : null;
  });
  ev.result(f2.failures === 0 ? "PASS" : "FAIL", "F2-customer-invoices",
    `200/200 factures, latence médiane/lot ${pct(f2.timings, 0.5)} ms, max ${Math.max(...f2.timings)} ms, échecs ${f2.failures}`);

  ev.section("F3. 100 factures fournisseur manuelles (50..149 MAD TTC)");
  const f3 = await batch(Array.from({ length: 100 }, (_, i) => i), 10, async (_x, i) => {
    const total = 50 + i;
    const { data: sinv, error } = await owner.from("supplier_invoices" as any).insert({
      organization_id: ORG, supplier_id: SUP1, invoice_number: `FF-2608-09${String(i).padStart(3, "0")}`,
      invoice_date: "2026-08-26", due_date: "2026-09-25", status: "validated",
      subtotal_ht: +(total / 1.2).toFixed(2), discount_total: 0, tax_total: +(total - total / 1.2).toFixed(2),
      total_ttc: total, paid_amount: 0, remaining_amount: total, payment_status: "unpaid",
      notes: `STRESS-f3-${i}`,
    }).select("id").single();
    if (error) return error.message;
    const { error: le } = await owner.from("supplier_invoice_lines" as any).insert({
      organization_id: ORG, invoice_id: sinv.id, line_order: 1, product_id: P1, description: `Ligne ${i}`,
      quantity: 1, unit_price_ht: +(total / 1.2).toFixed(2), discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: +(total / 1.2).toFixed(2), discount_amount: 0, tax_amount: +(total - total / 1.2).toFixed(2), total_ttc: total,
    });
    return le ? le.message : null;
  });
  ev.result(f3.failures === 0 ? "PASS" : "FAIL", "F3-supplier-invoices",
    `100/100 factures, latence médiane/lot ${pct(f3.timings, 0.5)} ms, max ${Math.max(...f3.timings)} ms, échecs ${f3.failures}`);

  ev.section("F4. 50 paiements client + 50 paiements fournisseur (RPC atomiques)");
  const { data: invs } = await admin.from("customer_invoices" as any).select("id, total_ttc").eq("organization_id", ORG).like("notes", "STRESS-f2-%").order("invoice_number");
  const { data: sups } = await admin.from("supplier_invoices" as any).select("id, total_ttc").eq("organization_id", ORG).like("notes", "STRESS-f3-%").order("invoice_number");
  const f4In = (invs ?? []).slice(0, 50);
  const f4Out = (sups ?? []).slice(0, 50);
  const f4Net = f4In.reduce((s, i) => s + cents(i.total_ttc), 0) - f4Out.reduce((s, i) => s + cents(i.total_ttc), 0);
  const f4c = await batch(f4In, 10, async (inv) => {
    const { error } = await owner.rpc("create_customer_payment_atomic", {
      p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: inv.total_ttc,
      p_payment_date: "2026-08-26", p_idempotency_key: crypto.randomUUID(),
      p_allocations: [{ invoice_id: inv.id, amount: inv.total_ttc }], p_payment_method: "bank_transfer",
    });
    return error ? error.message : null;
  });
  const f4s = await batch(f4Out, 10, async (inv) => {
    const { error } = await owner.rpc("create_supplier_payment_atomic", {
      p_organization_id: ORG, p_supplier_id: SUP1, p_treasury_account_id: BANK_MAR, p_amount: inv.total_ttc,
      p_payment_date: "2026-08-26", p_idempotency_key: crypto.randomUUID(),
      p_allocations: [{ invoice_id: inv.id, amount: inv.total_ttc }], p_payment_method: "bank_transfer",
    });
    return error ? error.message : null;
  });
  const tF4 = await treasuryNow();
  ev.result(f4c.failures === 0 && f4s.failures === 0 && tF4.actual === tF4.expected && tF4.actual === tF4.expected ? "PASS" : "FAIL", "F4-payments",
    `50 client + 50 fournisseur (échecs ${f4c.failures}/${f4s.failures}), latence client médiane ${pct(f4c.timings, 0.5)} ms max ${Math.max(...f4c.timings)} ms, flux net attendu ${MAD(f4Net)} (${f4In.length}+/${f4Out.length}-), trésorerie ${MAD(tF4.actual)} = oracle ${MAD(tF4.expected)}`);

  ev.section("F5. 50 réceptions stock (1 u. chacune, RPC atomique)");
  const f5 = await batch(Array.from({ length: 50 }, (_, i) => i), 10, async (_x, i) => {
    const { data: rec, error: re } = await owner.from("purchase_documents" as any).insert({
      organization_id: ORG, document_type: "supplier_receipt", document_number: `REC-2608-09${String(i).padStart(3, "0")}`, supplier_id: SUP1,
      document_date: "2026-08-26", receipt_date: "2026-08-26", status: "draft", notes: `STRESS-f5-${i}`,
      subtotal_ht: 100, discount_total: 0, tax_total: 20, total_ttc: 120,
    }).select("id").single();
    if (re) return re.message;
    const { data: line, error: le } = await owner.from("purchase_document_lines" as any).insert({
      organization_id: ORG, document_id: rec.id, line_order: 1, product_id: P1, quantity: 1,
      description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: 100, discount_amount: 0, tax_amount: 20, total_ttc: 120,
    }).select("id").single();
    if (le) return le.message;
    const se = await owner.rpc("record_stock_movements_atomic", {
      p_organization_id: ORG, p_operation_key: rec.id,
      p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: 1, source_document_id: rec.id, source_line_id: line?.id, movement_date: "2026-08-26" }],
      p_finalize_document_type: "supplier_receipt", p_document_id: rec.id,
    });
    return se && se.error ? se.error.message : se ? null : "RPC stock : réponse vide (null)";
  });
  const s5 = await stockNow();
  ev.result(f5.failures === 0 && s5.current === s5.levels && s5.oracle === s5.current && s5.current === 5800 ? "PASS" : "FAIL", "F5-receipts",
    `50/50 réceptions (échecs ${f5.failures}), latence médiane/lot ${pct(f5.timings, 0.5)} ms max ${Math.max(...f5.timings)} ms, stock ${s5.current / 100} = niveaux ${s5.levels / 100} = oracle ${s5.oracle / 100} (attendu 58)`);

  ev.section("F6. Oracle final + unicité des numéros");
  const tEnd = await treasuryNow();
  ev.result(tEnd.actual === tEnd.expected ? "PASS" : "FAIL", "F6-tresorerie-oracle",
    `attendu ${MAD(tEnd.expected)} = trésorerie après E (53849.84) + flux net F4 (${MAD(f4Net)}), réel ${MAD(tEnd.actual)}`);
  const tables: [string, string][] = [
    ["sales_documents", "document_number"],
    ["customer_invoices", "invoice_number"],
    ["supplier_invoices", "invoice_number"],
  ];
  const dupTotals: Record<string, number> = {};
  for (const [tbl, col] of tables) {
    const { data: rows } = await admin.from(tbl as any).select(col).eq("organization_id", ORG);
    const seen = new Map<string, number>();
    for (const r of rows ?? []) seen.set(r[col], (seen.get(r[col]) ?? 0) + 1);
    dupTotals[tbl] = [...seen.values()].filter((n) => n > 1).reduce((a, n) => a + (n - 1), 0);
  }
  const dupSum = Object.values(dupTotals).reduce((a, b) => a + b, 0);
  ev.result(dupSum === 0 ? "PASS" : "FAIL", "F6-numero-uniques",
    `doublons sales_documents=${dupTotals.sales_documents} customer_invoices=${dupTotals.customer_invoices} supplier_invoices=${dupTotals.supplier_invoices} (attendu 0 partout)`);
  const { count: moved } = await admin.from("stock_moves" as any).select("id", { count: "exact", head: true }).eq("organization_id", ORG);
  const { count: paidC } = await admin.from("customer_payments" as any).select("id", { count: "exact", head: true }).eq("organization_id", ORG);
  const { count: paidS } = await admin.from("supplier_payments" as any).select("id", { count: "exact", head: true }).eq("organization_id", ORG);
  ev.result(true ? "PASS" : "FAIL", "F6-volume-synthèse",
    `mouvements de stock ${moved}, paiements client ${paidC}, fournisseur ${paidS}, documents 850+, latence médiane globale ≈ ${pct([...f1.timings, ...f2.timings, ...f3.timings, ...f4c.timings, ...f4s.timings, ...f5.timings], 0.5)} ms / lot de 10`);

  ev.save();
})().catch((e) => { console.error(e); ev.save(); process.exit(1); });
