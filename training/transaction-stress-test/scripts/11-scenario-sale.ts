/* SCÉNARIO B — VENTE de référence (flux déterministe via sessions RLS réelles,
 * mêmes payloads/RPC que les Server Actions). 3 u. STRESS-P1 @500 HT TVA 20 % →
 * commande confirmée → BL 3 u. (delivery_out, finalize delivery_note) → facture
 * client 1800 TTC → paiement client 1800 → dette 0, stock -3, trésorerie +1800.
 * S'exécute APRÈS le scénario A (stock 10) sans reset du tenant.
 * Oracle en centimes, tolérance 0,01 MAD.
 */
import { admin, session, EMAIL, Evidence, oracleLine, oracleTotals, oracleInvoiceRemaining, oracleTreasury, oracleStock, sameMoney, cents, MAD } from "./lib/harness.ts";

const ev = new Evidence("Scénario B — Vente de référence (3 u. @500 HT TVA 20 %)", "11_scenario_sale");

const lookups = await (async () => {
  const org = (await admin.from("organizations" as any).select("id").eq("slug", "stress-flx-2026-001").single()).data;
  const p1 = (await admin.from("products" as any).select("id").eq("organization_id", org.id).eq("sku", "STRESS-P1").single()).data;
  const vat = (await admin.from("tax_rates" as any).select("id").eq("code", "VAT_20").eq("is_system", true).single()).data;
  const cust = (await admin.from("third_parties" as any).select("id").eq("organization_id", org.id).eq("name", "STRESS-Client-Retail-Casablanca").single()).data;
  const wh = (await admin.from("warehouses" as any).select("id").eq("organization_id", org.id).eq("code", "WH-MAR").eq("status", "active").single()).data;
  const bank = (await admin.from("treasury_accounts" as any).select("id").eq("organization_id", org.id).eq("name", "Banque Marrakech").single()).data;
  return { org: org.id, p1: p1.id, vat: vat.id, cust: cust.id, wh: wh.id, bank: bank.id };
})();
const ORG = lookups.org, P1 = lookups.p1, VAT20 = lookups.vat, CUST1 = lookups.cust, WH_MAR = lookups.wh, BANK_MAR = lookups.bank;

const sales = await session(EMAIL("sales"));
const owner = await session(EMAIL("owner"));
const runId = Date.now().toString(36);
const tag = (s: string) => `STRESS-${s}-${runId}`;

(async () => {
  ev.section("B1. Commande client 3 u. @500 HT");
  const l = oracleLine(3, 500, 0, 20);
  const { data: order, error: oErr } = await sales.from("sales_documents" as any).insert({
    organization_id: ORG, document_type: "order", document_number: "", customer_id: CUST1,
    document_date: "2026-08-11", status: "draft", notes: tag("order"),
    subtotal_ht: l.subtotal_ht / 100, tax_total: l.tax_amount / 100, total_ttc: l.total_ttc / 100,
  }).select("id").single();
  if (oErr) { ev.result("BLOCKED", "B1-order", oErr.message); ev.save(); process.exit(1); }
  const { data: oLine, error: olErr } = await sales.from("sales_document_lines" as any).insert({
    organization_id: ORG, document_id: order.id, line_order: 1, product_id: P1,
    description: "", quantity: 3, unit_price_ht: 500, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
    subtotal_ht: l.subtotal_ht / 100, tax_amount: l.tax_amount / 100, total_ttc: l.total_ttc / 100,
    ordered_quantity: 3, delivered_quantity: 0, remaining_quantity: 3,
  }).select("id").single();
  const { error: cErr } = await sales.from("sales_documents" as any).update({ status: "confirmed" }).eq("id", order.id).eq("organization_id", ORG);
  ev.result(olErr || cErr ? "FAIL" : "PASS", "B1-order", olErr ? olErr.message : cErr ? cErr.message : `commande ${order.id}, ligne oracle ${MAD(l.subtotal_ht)} HT / ${MAD(l.tax_amount)} TVA / ${MAD(l.total_ttc)} TTC`);

  ev.section("B2. Bon de livraison 3 u. (delivery_out, finalize delivery_note)");
  const dl = oracleLine(3, 500, 0, 20);
  const { data: bl, error: blErr } = await sales.from("sales_documents" as any).insert({
    organization_id: ORG, document_type: "delivery_note", document_number: "", customer_id: CUST1,
    source_document_id: order.id, related_order_id: order.id,
    document_date: "2026-08-11", status: "draft",
    subtotal_ht: dl.subtotal_ht / 100, tax_total: dl.tax_amount / 100, total_ttc: dl.total_ttc / 100,
  }).select("id").single();
  if (blErr) { ev.result("BLOCKED", "B2-bl", blErr.message); ev.save(); process.exit(1); }
  const { data: blLine, error: blLineErr } = await sales.from("sales_document_lines" as any).insert({
    organization_id: ORG, document_id: bl.id, line_order: 1, product_id: P1,
    description: "", quantity: 3, unit_price_ht: 500, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
    subtotal_ht: dl.subtotal_ht / 100, tax_amount: dl.tax_amount / 100, total_ttc: dl.total_ttc / 100,
    source_line_id: oLine?.id, ordered_quantity: 3, delivered_quantity: 3, remaining_quantity: 0,
  }).select("id").single();
  const { data: stMoves, error: stErr } = await owner.rpc("record_stock_movements_atomic", {
    p_organization_id: ORG, p_operation_key: bl.id,
    p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "delivery_out", direction: "out", quantity: 3, source_document_id: bl.id, source_line_id: blLine?.id, movement_date: "2026-08-11" }],
    p_finalize_document_type: "delivery_note", p_document_id: bl.id,
  });
  const { data: orderAfter } = await admin.from("sales_documents" as any).select("status").eq("id", order.id).single();
  ev.result(!blLineErr && !stErr && orderAfter?.status === "delivered" ? "PASS" : "FAIL", "B2-bl-stock",
    blLineErr ? blLineErr.message : stErr ? stErr.message : `BL ${bl.id} finalisé, commande ${orderAfter?.status}, mouvements=${JSON.stringify(stMoves)}`);

  ev.section("B3. Facture client 1800 TTC (depuis BL)");
  const tot = oracleTotals([dl]);
  const { data: inv, error: iErr } = await sales.from("customer_invoices" as any).insert({
    organization_id: ORG, customer_id: CUST1, source_type: "delivery_note",
    source_document_id: bl.id, source_order_id: order.id, source_delivery_id: bl.id,
    invoice_date: "2026-08-12", due_date: "2026-09-11", status: "validated", payment_status: "unpaid",
    payment_terms_days: 30, paid_amount: 0, remaining_amount: tot.total_ttc / 100,
    subtotal_ht: tot.subtotal_ht / 100, discount_total: 0, tax_total: tot.tax_total / 100, total_ttc: tot.total_ttc / 100,
  }).select("id, invoice_number").single();
  if (iErr) { ev.result("BLOCKED", "B3-invoice", iErr.message); ev.save(); process.exit(1); }
  const { error: ilErr } = await sales.from("customer_invoice_lines" as any).insert({
    organization_id: ORG, invoice_id: inv.id, source_line_id: blLine?.id, source_document_id: bl.id,
    product_id: P1, description: "", quantity: 3, unit_price_ht: 500, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
    subtotal_ht: dl.subtotal_ht / 100, discount_amount: 0, tax_amount: dl.tax_amount / 100, total_ttc: dl.total_ttc / 100,
  });
  ev.result(ilErr ? "FAIL" : "PASS", "B3-invoice", ilErr ? ilErr.message : `${inv.invoice_number} totaux ${MAD(tot.subtotal_ht)} HT / ${MAD(tot.tax_total)} TVA / ${MAD(tot.total_ttc)} TTC`);

  ev.section("B4. Paiement client 1800 (RPC atomique)");
  const pay = await owner.rpc("create_customer_payment_atomic", {
    p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 1800,
    p_payment_date: "2026-08-13", p_idempotency_key: crypto.randomUUID(),
    p_allocations: [{ invoice_id: inv.id, amount: 1800 }], p_payment_method: "bank_transfer",
  });
  ev.result(pay.error ? "FAIL" : "PASS", "B4-cpay-1800", pay.error ? pay.error.message : `pay=${JSON.stringify(pay.data)}`);

  ev.section("B5. Vérifications oracle (invariants §17)");
  const { data: check } = await admin.from("customer_invoices" as any).select("paid_amount,remaining_amount,payment_status,total_ttc").eq("id", inv.id).single();
  const rem = oracleInvoiceRemaining(cents(check?.total_ttc ?? 1800), [{ amount: 1800, cancelled_at: null }]);
  const okI = check && rem === 0 && check.remaining_amount === 0 && check.payment_status === "paid";
  ev.result(okI ? "PASS" : "FAIL", "B5-dette-zero", `oracle reste=${MAD(rem)}, réel ${JSON.stringify(check)}`);

  const { data: acc } = await admin.from("treasury_accounts" as any).select("opening_balance,current_balance").eq("id", BANK_MAR).single();
  const { data: moves } = await admin.from("treasury_transactions" as any).select("direction,amount,transaction_type,archived_at").eq("treasury_account_id", BANK_MAR);
  const expected = oracleTreasury(acc, moves ?? []);
  ev.result(sameMoney(expected, cents(acc?.current_balance)) ? "PASS" : "FAIL", "B5-tresorerie",
    `attendu ${MAD(expected)} = opening + Σmvt (50000-400-800+1800), réel ${MAD(cents(acc?.current_balance))}`);

  const { data: prod } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
  const { data: levels } = await admin.from("stock_levels" as any).select("quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const { data: allMoves } = await admin.from("stock_moves" as any).select("direction,quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const expStock = oracleStock(allMoves ?? []);
  const lvlSum = (levels ?? []).reduce((a, lv) => a + cents(lv.quantity), 0);
  ev.result(cents(prod?.current_stock) === cents(expStock) && lvlSum === cents(expStock) && cents(expStock) === 700 ? "PASS" : "FAIL", "B5-stock",
    `oracle Σin-Σout=${expStock}, current=${prod?.current_stock ?? "?"} cumul emplacements=${lvlSum / 100} (attendu 7 = 10-3)`);

  const { data: payRows } = await admin.from("customer_payments" as any).select("payment_number,amount,allocated_amount,available_amount,status").eq("organization_id", ORG).order("payment_number");
  ev.result(!payRows || payRows.every((r) => cents(r.allocated_amount) + cents(r.available_amount) === cents(r.amount)) ? "PASS" : "FAIL", "B5-allocations",
    JSON.stringify(payRows));

  ev.save();
})().catch((e) => { console.error(e); ev.save(); process.exit(1); });
