/* SCÉNARIO D — CONCURRENCE (exécutions parallèles réelles via Promise.all,
 * deux sessions distinctes, vérrous + idempotence sous charge) :
 * D1 double paiement même clé → exactement 1 accepté + 1 replayed, trésorerie une fois
 * D2 paiements parallèles clés différentes sur la même facture → 1 seul accepté
 * D3 rejeu stock concurrent même operation_key → 1 seul mouvement, stock +3 une fois
 * D4 réceptions parallèles clés différentes → aucun mouvement perdu (stock = somme)
 * D5 livraisons parallèles > stock → jamais de stock négatif, 1 seule acceptée
 * S'exécute APRÈS A+B+C (stock 7, trésorerie 51774.92).
 */
import { admin, session, EMAIL, Evidence, oracleTreasury, oracleStock, sameMoney, cents, MAD } from "./lib/harness.ts";

const ev = new Evidence("Scénario D — Concurrence et idempotence sous charge parallèle", "13_scenario_concurrency");

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

const owner1 = await session(EMAIL("owner"));
const owner2 = await session(EMAIL("owner"));
const runId = Date.now().toString(36);
const tag = (s: string) => `STRESS-${s}-${runId}`;

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
const mkInvoice = async (total: number, notes: string) => {
  const { data, error } = await owner1.from("customer_invoices" as any).insert({
    organization_id: ORG, customer_id: CUST1, source_type: "manual",
    invoice_date: "2026-08-20", due_date: "2026-09-19", status: "validated", payment_status: "unpaid",
    payment_terms_days: 30, paid_amount: 0, remaining_amount: total,
    subtotal_ht: +(total / 1.2).toFixed(2), discount_total: 0, tax_total: +(total - total / 1.2).toFixed(2), total_ttc: total, notes,
  }).select("id, invoice_number").single();
  if (data && !error) {
    await owner1.from("customer_invoice_lines" as any).insert({
      organization_id: ORG, invoice_id: data.id, line_order: 1, product_id: P1,
      description: "Ligne conforme", quantity: 1, unit_price_ht: +(total / 1.2).toFixed(2), discount_rate: 0,
      tax_rate_id: VAT20, tax_rate: 20, subtotal_ht: +(total / 1.2).toFixed(2), discount_amount: 0,
      tax_amount: +(total - total / 1.2).toFixed(2), total_ttc: total,
    });
  }
  return { inv: data, err: error };
};

(async () => {
  ev.section("D1. Double paiement simultané — même clé d'idempotence (facture 1174.92)");
  const { inv: inv1, err: e1 } = await mkInvoice(1174.92, tag("d1"));
  if (e1) { ev.result("BLOCKED", "D1-setup", e1.message); ev.save(); process.exit(1); }
  const keyD1 = crypto.randomUUID();
  const [r1, r2] = await Promise.all([
    owner1.rpc("create_customer_payment_atomic", { p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 1174.92, p_payment_date: "2026-08-20", p_idempotency_key: keyD1, p_allocations: [{ invoice_id: inv1.id, amount: 1174.92 }], p_payment_method: "bank_transfer" }),
    owner2.rpc("create_customer_payment_atomic", { p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 1174.92, p_payment_date: "2026-08-20", p_idempotency_key: keyD1, p_allocations: [{ invoice_id: inv1.id, amount: 1174.92 }], p_payment_method: "bank_transfer" }),
  ]);
  const { data: pays1 } = await admin.from("customer_payments" as any).select("id,amount,status").eq("organization_id", ORG).eq("idempotency_key", keyD1);
  const { data: inv1After } = await admin.from("customer_invoices" as any).select("remaining_amount,payment_status").eq("id", inv1.id).single();
  const t1 = await treasuryNow();
  const okD1 = !r1.error && !r2.error && pays1?.length === 1
    && (r1.data?.[0]?.replayed !== r2.data?.[0]?.replayed)
    && cents(inv1After?.remaining_amount) === 0 && inv1After?.payment_status === "paid" && t1.actual === t1.expected;
  ev.result(okD1 ? "PASS" : "FAIL", "D1-same-key",
    `r1=${JSON.stringify(r1.data ?? r1.error?.message)} r2=${JSON.stringify(r2.data ?? r2.error?.message)} — ${pays1?.length ?? 0} paiement en base, facture ${inv1After?.remaining_amount} (${inv1After?.payment_status}), trésorerie ${MAD(t1.actual)}`);

  ev.section("D2. Paiements parallèles — clés différentes, même facture (1000, deux × 700)");
  const { inv: inv2, err: e2 } = await mkInvoice(1000, tag("d2"));
  if (e2) { ev.result("BLOCKED", "D2-setup", e2.message); ev.save(); process.exit(1); }
  const [q1, q2] = await Promise.all([
    owner1.rpc("create_customer_payment_atomic", { p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 700, p_payment_date: "2026-08-20", p_idempotency_key: crypto.randomUUID(), p_allocations: [{ invoice_id: inv2.id, amount: 700 }], p_payment_method: "bank_transfer" }),
    owner2.rpc("create_customer_payment_atomic", { p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 700, p_payment_date: "2026-08-20", p_idempotency_key: crypto.randomUUID(), p_allocations: [{ invoice_id: inv2.id, amount: 700 }], p_payment_method: "bank_transfer" }),
  ]);
  const { data: allocs2 } = await admin.from("customer_payment_allocations" as any).select("id,amount,cancelled_at").eq("organization_id", ORG).eq("invoice_id", inv2.id);
  const { data: inv2After } = await admin.from("customer_invoices" as any).select("remaining_amount,payment_status").eq("id", inv2.id).single();
  const t2 = await treasuryNow();
  const accepted2 = [q1, q2].filter((r) => !r.error).length;
  const okD2 = accepted2 === 1 && inv2After && cents(inv2After.remaining_amount) === 30000 && inv2After.payment_status === "partial" && t2.actual === t2.expected;
  ev.result(okD2 ? "PASS" : "FAIL", "D2-different-keys",
    `acceptés=${accepted2}/2 (attendus 1) — q1=${q1.error?.message ?? JSON.stringify(q1.data)} q2=${q2.error?.message ?? JSON.stringify(q2.data)} — reste ${inv2After?.remaining_amount} (${inv2After?.payment_status}), allocations=${allocs2?.length ?? 0}`);

  ev.section("D3. Rejeu stock concurrent — même operation_key (réception 3 u.)");
  const { data: rec3, error: r3Err } = await owner1.from("purchase_documents" as any).insert({
    organization_id: ORG, document_type: "supplier_receipt", document_number: "", supplier_id: SUP1,
    document_date: "2026-08-20", receipt_date: "2026-08-20", status: "draft",
    subtotal_ht: 300, tax_total: 60, total_ttc: 360,
  }).select("id").single();
  if (r3Err) { ev.result("BLOCKED", "D3-setup", r3Err.message); ev.save(); process.exit(1); }
  const { data: rec3Line, error: r3lErr } = await owner1.from("purchase_document_lines" as any).insert({
    organization_id: ORG, document_id: rec3.id, line_order: 1, product_id: P1, quantity: 3,
    description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
    subtotal_ht: 300, discount_amount: 0, tax_amount: 60, total_ttc: 360,
  }).select("id").single();
  const [s1, s2] = await Promise.all([
    owner1.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: rec3.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: 3, source_document_id: rec3.id, source_line_id: rec3Line?.id, movement_date: "2026-08-20" }], p_finalize_document_type: "supplier_receipt", p_document_id: rec3.id }),
    owner2.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: rec3.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: 3, source_document_id: rec3.id, source_line_id: rec3Line?.id, movement_date: "2026-08-20" }], p_finalize_document_type: "supplier_receipt", p_document_id: rec3.id }),
  ]);
  const st3 = await stockNow();
  const okD3 = !r3lErr && !s1.error && !s2.error && st3.current === st3.levels && st3.oracle === st3.current && st3.current === 1000;
  ev.result(okD3 ? "PASS" : "FAIL", "D3-stock-replay",
    `s1=${JSON.stringify(s1.data ?? s1.error?.message)} s2=${JSON.stringify(s2.data ?? s2.error?.message)} — stock ${st3.current / 100} (attendu 10 = 7+3), niveaux ${st3.levels / 100}, oracle ${st3.oracle / 100}`);

  ev.section("D4. Réceptions parallèles — clés différentes (2 u. + 3 u.), aucun mouvement perdu");
  const mkRec = async (qty: number, num: string) => {
    const { data: rec, error: re } = await owner1.from("purchase_documents" as any).insert({
      organization_id: ORG, document_type: "supplier_receipt", document_number: num, supplier_id: SUP1,
      document_date: "2026-08-21", receipt_date: "2026-08-21", status: "draft",
      subtotal_ht: qty * 100, tax_total: qty * 20, total_ttc: qty * 120,
    }).select("id").single();
    if (re) return { rec: null as any, line: null as any, err: re };
    const { data: line, error: le } = await owner1.from("purchase_document_lines" as any).insert({
      organization_id: ORG, document_id: rec.id, line_order: 1, product_id: P1, quantity: qty,
      description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: qty * 100, discount_amount: 0, tax_amount: qty * 20, total_ttc: qty * 120,
    }).select("id").single();
    return { rec, line, err: le };
  };
  /* NOTE CONCURRENCE : même constat que D5 — génération parallèle des numéros
   * purchase_documents (SELECT max+1 non verrouillé) → violation d'unicité.
   * Numéros explicites ci-dessous. */
  const [r4a, r4b] = await Promise.all([mkRec(2, "REC-2608-09701"), mkRec(3, "REC-2608-09702")]);
  if (r4a.err || r4b.err) { ev.result("BLOCKED", "D4-setup", (r4a.err ?? r4b.err)?.message); ev.save(); process.exit(1); }
  const [f1, f2] = await Promise.all([
    owner1.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: r4a.rec.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: 2, source_document_id: r4a.rec.id, source_line_id: r4a.line.id, movement_date: "2026-08-21" }], p_finalize_document_type: "supplier_receipt", p_document_id: r4a.rec.id }),
    owner2.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: r4b.rec.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: 3, source_document_id: r4b.rec.id, source_line_id: r4b.line.id, movement_date: "2026-08-21" }], p_finalize_document_type: "supplier_receipt", p_document_id: r4b.rec.id }),
  ]);
  const st4 = await stockNow();
  const okD4 = !f1.error && !f2.error && st4.current === st4.levels && st4.oracle === st4.current && st4.current === 1500;
  ev.result(okD4 ? "PASS" : "FAIL", "D4-parallel-receipts",
    `f1=${f1.error?.message ?? JSON.stringify(f1.data)} f2=${f2.error?.message ?? JSON.stringify(f2.data)} — stock ${st4.current / 100} (attendu 15 = 10+2+3), niveaux ${st4.levels / 100}`);

  ev.section("D5. Livraisons parallèles au-delà du stock (2 × 8 u. sur stock 15)");
  const mkBl = async (qty: number, num: string) => {
    const { data: bl, error: be } = await owner1.from("sales_documents" as any).insert({
      organization_id: ORG, document_type: "delivery_note", document_number: num, customer_id: CUST1,
      document_date: "2026-08-22", status: "draft",
      subtotal_ht: qty, tax_total: qty * 0.2, total_ttc: qty * 1.2,
    }).select("id").single();
    if (be) return { bl: null as any, line: null as any, err: be };
    const { data: line, error: le } = await owner1.from("sales_document_lines" as any).insert({
      organization_id: ORG, document_id: bl.id, line_order: 1, product_id: P1, description: "",
      quantity: qty, unit_price_ht: 1, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: qty, tax_amount: qty * 0.2, total_ttc: qty * 1.2, ordered_quantity: qty, delivered_quantity: qty, remaining_quantity: 0,
    }).select("id").single();
    return { bl, line, err: le };
  };
  /* NOTE CONCURRENCE : 2 insertions simultanées de sales_documents SANS numéro
   * explicite → violation d'unicité (le trigger SELECT max+1 n'est pas verrouillé,
   * contrairement aux factures via numbering_sequences FOR UPDATE). Découverte
   * documentée §findings — les numéros ci-dessous sont donc pré-affectés. */
  const [b5a, b5b] = await Promise.all([mkBl(8, "BL-2608-09901"), mkBl(8, "BL-2608-09902")]);
  if (b5a.err || b5b.err) { ev.result("BLOCKED", "D5-setup", (b5a.err ?? b5b.err)?.message); ev.save(); process.exit(1); }
  const [g1, g2] = await Promise.all([
    owner1.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: b5a.bl.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "delivery_out", direction: "out", quantity: 8, source_document_id: b5a.bl.id, source_line_id: b5a.line.id, movement_date: "2026-08-22" }], p_finalize_document_type: "delivery_note", p_document_id: b5a.bl.id }),
    owner2.rpc("record_stock_movements_atomic", { p_organization_id: ORG, p_operation_key: b5b.bl.id, p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "delivery_out", direction: "out", quantity: 8, source_document_id: b5b.bl.id, source_line_id: b5b.line.id, movement_date: "2026-08-22" }], p_finalize_document_type: "delivery_note", p_document_id: b5b.bl.id }),
  ]);
  const st5 = await stockNow();
  const accepted5 = [g1, g2].filter((r) => !r.error).length;
  const okD5 = accepted5 === 1 && st5.current === st5.levels && st5.oracle === st5.current && st5.current >= 0 && st5.current === 700;
  ev.result(okD5 ? "PASS" : "FAIL", "D5-parallel-deliveries",
    `acceptées=${accepted5}/2 (attendue 1) — g1=${g1.error?.message ?? JSON.stringify(g1.data)} g2=${g2.error?.message ?? JSON.stringify(g2.data)} — stock final ${st5.current / 100} (attendu 7 = 15-8), jamais négatif`);

  const tEnd = await treasuryNow();
  ev.result(tEnd.actual === tEnd.expected ? "PASS" : "FAIL", "D-final-tresorerie-oracle", `attendu ${MAD(tEnd.expected)}, réel ${MAD(tEnd.actual)}`);

  ev.save();
})().catch((e) => { console.error(e); ev.save(); process.exit(1); });
