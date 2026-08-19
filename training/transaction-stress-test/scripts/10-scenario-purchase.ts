/* SCÉNARIO A — ACHAT de référence (flux déterministe via sessions RLS réelles,
 * mêmes payloads/RPC que les Server Actions). 10 u. @100 HT TVA 20 % →
 * réceptions 6+4 → facture fournisseur → paiements 400 puis 800 → dette 0,
 * stock +10, trésorerie -1200. Oracle en centimes, tolérance 0,01 MAD.
 */
import { admin, session, EMAIL, Evidence, oracleLine, oracleTotals, oracleInvoiceRemaining, oracleTreasury, sameMoney, cents, MAD } from "./lib/harness.ts";

const ev = new Evidence("Scénario A — Achat de référence (10 u. @100 HT TVA 20 %)", "10_scenario_purchase");

const lookups = await (async () => {
  const org = (await admin.from("organizations" as any).select("id").eq("slug", "stress-flx-2026-001").single()).data;
  const p1 = (await admin.from("products" as any).select("id").eq("organization_id", org.id).eq("sku", "STRESS-P1").single()).data;
  const vat = (await admin.from("tax_rates" as any).select("id").eq("code", "VAT_20").eq("is_system", true).single()).data;
  const sup = (await admin.from("third_parties" as any).select("id").eq("organization_id", org.id).eq("name", "STRESS-Fournisseur-Import-Safi").single()).data;
  const wh = (await admin.from("warehouses" as any).select("id").eq("organization_id", org.id).eq("code", "WH-MAR").single()).data;
  const bank = (await admin.from("treasury_accounts" as any).select("id").eq("organization_id", org.id).eq("name", "Banque Marrakech").single()).data;
  return { org: org.id, p1: p1.id, vat: vat.id, sup: sup.id, wh: wh.id, bank: bank.id };
})();
const ORG = lookups.org, P1 = lookups.p1, VAT20 = lookups.vat, SUP1 = lookups.sup, WH_MAR = lookups.wh, BANK_MAR = lookups.bank;

const purchase = await session(EMAIL("purchase"));
const owner = await session(EMAIL("owner"));
const runId = Date.now().toString(36);
const tag = (s: string) => `STRESS-${s}-${runId}`;

(async () => {
  ev.section("A1. Commande fournisseur 10 u. @100 HT");
  const { data: po, error: poErr } = await purchase.from("purchase_documents" as any).insert({
    organization_id: ORG, document_type: "supplier_order", document_number: "", supplier_id: SUP1,
    document_date: "2026-08-11", status: "draft", notes: tag("po"),
    subtotal_ht: 1000, tax_total: 200, total_ttc: 1200,
  }).select("id").single();
  if (poErr) { ev.result("BLOCKED", "A1-po", poErr.message); ev.save(); process.exit(1); }
  const poLine = oracleLine(10, 100, 0, 20);
  const { error: lErr } = await purchase.from("purchase_document_lines" as any).insert({
    organization_id: ORG, document_id: po.id, line_order: 1, product_id: P1, quantity: 10,
    description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
    subtotal_ht: poLine.subtotal_ht / 100, discount_amount: 0, tax_amount: poLine.tax_amount / 100,
    total_ttc: poLine.total_ttc / 100, ordered_quantity: 10, received_quantity: 0, remaining_quantity: 10,
  });
  ev.result(lErr ? "FAIL" : "PASS", "A1-po", lErr ? lErr.message : `commande ${po.id}, ligne oracle ${MAD(poLine.subtotal_ht)} HT / ${MAD(poLine.tax_amount)} TVA / ${MAD(poLine.total_ttc)} TTC`);
  const { error: vErr } = await purchase.from("purchase_documents" as any).update({ status: "confirmed" }).eq("id", po.id).eq("organization_id", ORG);
  ev.result(vErr ? "FAIL" : "PASS", "A1-po-validate", vErr ? vErr.message : "commande confirmée");

  ev.section("A2-A3. Réceptions 6 puis 4 (WH Marrakech) + stock atomique");
  let stockChecks: boolean[] = [];
  let recIds: string[] = [];
  for (const qty of [6, 4]) {
    const { data: rec, error: rErr } = await purchase.from("purchase_documents" as any).insert({
      organization_id: ORG, document_type: "supplier_receipt", document_number: "", supplier_id: SUP1,
      source_document_id: po.id, related_order_id: po.id, warehouse_id: WH_MAR,
      document_date: "2026-08-11", receipt_date: "2026-08-11", status: "draft",
      subtotal_ht: (qty * 100).toFixed(2), tax_total: (qty * 20).toFixed(2), total_ttc: (qty * 120).toFixed(2),
    }).select("id").single();
    if (rErr) { ev.result("FAIL", `A2-receipt-${qty}`, rErr.message); continue; }
    recIds.push(rec.id);
    const l = oracleLine(qty, 100, 0, 20);
    const { data: recLine, error: rlErr } = await purchase.from("purchase_document_lines" as any).insert({
      organization_id: ORG, document_id: rec.id, line_order: 1, product_id: P1, quantity: qty,
      description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: l.subtotal_ht / 100, discount_amount: 0, tax_amount: l.tax_amount / 100,
      total_ttc: l.total_ttc / 100, ordered_quantity: 10, received_quantity: qty, remaining_quantity: 10 - qty,
    }).select("id").single();
    const { error: sErr } = await owner.rpc("record_stock_movements_atomic", {
      p_organization_id: ORG, p_operation_key: rec.id,
      p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: qty, source_document_id: rec.id, source_line_id: recLine?.id, movement_date: "2026-08-11" }],
      p_finalize_document_type: "supplier_receipt", p_document_id: rec.id,
    });
    const ok = !rlErr && !sErr;
    stockChecks.push(ok);
    ev.result(ok ? "PASS" : "FAIL", `A2-receipt-${qty}`, rlErr ? rlErr.message : sErr ? sErr.message : `réception +${qty} stockée`);
  }

  ev.section("A4. Facture fournisseur 10 u. (depuis réceptions 6+4)");
  const tot = oracleTotals([oracleLine(6, 100, 0, 20), oracleLine(4, 100, 0, 20)]);
  const { data: sinv, error: sInvErr } = await purchase.from("supplier_invoices" as any).insert({
    organization_id: ORG, supplier_id: SUP1, source_receipt_id: recIds[0] ?? null,
    invoice_date: "2026-08-12", due_date: "2026-09-11", status: "validated",
    subtotal_ht: tot.subtotal_ht / 100, discount_total: 0, tax_total: tot.tax_total / 100,
    total_ttc: tot.total_ttc / 100, paid_amount: 0, remaining_amount: tot.total_ttc / 100, payment_status: "unpaid",
  }).select("id, invoice_number").single();
  if (sInvErr) { ev.result("BLOCKED", "A4-supplier-invoice", sInvErr.message); ev.save(); process.exit(1); }
  let linesOk = true;
  for (const [qty, src] of [[6, recIds[0]], [4, recIds[1]]] as const) {
    if (!src) continue;
    const l = oracleLine(qty, 100, 0, 20);
    const { error: liErr } = await purchase.from("supplier_invoice_lines" as any).insert({
      organization_id: ORG, invoice_id: sinv.id, source_document_id: src, product_id: P1,
      quantity: qty, description: "", unit_price_ht: 100, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: l.subtotal_ht / 100, discount_amount: 0, tax_amount: l.tax_amount / 100, total_ttc: l.total_ttc / 100,
    });
    if (liErr) { linesOk = false; ev.result("FAIL", `A4-line-${qty}`, liErr.message); }
  }
  ev.result(!linesOk ? "FAIL" : "PASS", "A4-supplier-invoice", `${sinv.invoice_number} totaux ${MAD(tot.subtotal_ht)} HT / ${MAD(tot.tax_total)} TVA / ${MAD(tot.total_ttc)} TTC`);

  ev.section("A5. Paiements fournisseur 400 puis 800 (RPC atomique)");
  const p1 = await owner.rpc("create_supplier_payment_atomic", {
    p_organization_id: ORG, p_supplier_id: SUP1, p_treasury_account_id: BANK_MAR, p_amount: 400,
    p_payment_date: "2026-08-13", p_idempotency_key: crypto.randomUUID(),
    p_allocations: [{ invoice_id: sinv.id, amount: 400 }], p_payment_method: "bank_transfer",
  });
  const p2 = await owner.rpc("create_supplier_payment_atomic", {
    p_organization_id: ORG, p_supplier_id: SUP1, p_treasury_account_id: BANK_MAR, p_amount: 800,
    p_payment_date: "2026-08-14", p_idempotency_key: crypto.randomUUID(),
    p_allocations: [{ invoice_id: sinv.id, amount: 800 }], p_payment_method: "bank_transfer",
  });
  ev.result(p1.error ? "FAIL" : "PASS", "A5-spay-400", p1.error ? p1.error.message : `pay1=${JSON.stringify(p1.data)}`);
  ev.result(p2.error ? "FAIL" : "PASS", "A5-spay-800", p2.error ? p2.error.message : `pay2=${JSON.stringify(p2.data)}`);

  ev.section("A6. Vérifications oracle (invariants §17)");
  const { data: check } = await admin.from("supplier_invoices" as any).select("paid_amount,remaining_amount,payment_status,total_ttc").eq("id", sinv.id).single();
  const rem = oracleInvoiceRemaining(cents(check?.total_ttc ?? 1200), [400, 800].map((a) => ({ amount: a, cancelled_at: null })));
  const okA = check && rem === 0 && check.remaining_amount === 0 && check.payment_status === "paid";
  ev.result(okA ? "PASS" : "FAIL", "A6-dette-zero", `oracle reste=${MAD(rem)}, réel ${JSON.stringify(check)}`);

  const { data: acc } = await admin.from("treasury_accounts" as any).select("opening_balance,current_balance").eq("id", BANK_MAR).single();
  const { data: moves } = await admin.from("treasury_transactions" as any).select("direction,amount,transaction_type,archived_at").eq("treasury_account_id", BANK_MAR);
  const expected = oracleTreasury(acc, moves ?? []);
  ev.result(sameMoney(expected, cents(acc?.current_balance)) ? "PASS" : "FAIL", "A6-tresorerie",
    `attendu ${MAD(expected)} = opening + Σmvt, réel ${MAD(cents(acc?.current_balance))}`);

  const { data: prod } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
  const { data: levels } = await admin.from("stock_levels" as any).select("quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const lvlSum = (levels ?? []).reduce((a, l) => a + cents(l.quantity), 0);
  ev.result(stockChecks.every(Boolean) && cents(prod?.current_stock) === 1000 && lvlSum === 1000 ? "PASS" : "FAIL", "A6-stock",
    `current=${prod?.current_stock ?? "?"} cumul emplacements=${lvlSum / 100} (attendu 10)`);

  const { data: payRows } = await admin.from("supplier_payments" as any).select("payment_number,amount,allocated_amount,available_amount,status").eq("organization_id", ORG).order("payment_number");
  ev.result(!payRows || payRows.every((r) => cents(r.allocated_amount) + cents(r.available_amount) === cents(r.amount)) ? "PASS" : "FAIL", "A6-allocations",
    JSON.stringify(payRows));

  ev.save();
})().catch((e) => { console.error(e); ev.save(); process.exit(1); });
