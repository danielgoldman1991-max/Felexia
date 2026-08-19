/* SCÉNARIO C — MÉTAMORPHIQUE (invariants §17 sous variations) :
 * C1 multi-lignes remises/TVA 0 (facture manuelle, totaux = somme des lignes arrondies)
 * C2 arrondi centime (3 × 33.33 @100 TVA 20 %)
 * C3 surpaiement rejeté (allocations > reste → erreur RPC, aucun débit)
 * C4 paiements partiels + rejeu idempotent (même clé → replayed, trésorerie inchangée)
 * C5 rejeu idempotent stock (même operation_key → replayed, stock inchangé)
 * C6 stock négatif refusé (delivery_out 999 → erreur)
 * C7 annulation facture (montants conservés, aucun paiement enregistré)
 * S'exécute APRÈS A+B (stock 7, trésorerie 50600).
 */
import { admin, session, EMAIL, Evidence, oracleLine, oracleTotals, oracleTreasury, sameMoney, cents, MAD } from "./lib/harness.ts";

const ev = new Evidence("Scénario C — Métamorphique (arrondis, remises, idempotence, garde-fous)", "12_scenario_metamorphic");

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

const owner = await session(EMAIL("owner"));
const sales = await session(EMAIL("sales"));
const runId = Date.now().toString(36);
const tag = (s: string) => `STRESS-${s}-${runId}`;

const treasuryNow = async () => {
  const { data: acc } = await admin.from("treasury_accounts" as any).select("opening_balance,current_balance").eq("id", BANK_MAR).single();
  const { data: moves } = await admin.from("treasury_transactions" as any).select("direction,amount,transaction_type,archived_at").eq("treasury_account_id", BANK_MAR);
  return { actual: cents(acc?.current_balance), expected: oracleTreasury(acc, moves ?? []) };
};

(async () => {
  ev.section("C1. Facture manuelle multi-lignes (remise 10 % + TVA 0 %) — totaux oracle");
  const lines = [
    oracleLine(7, 99.99, 10, 20),
    oracleLine(2, 149.5, 0, 0),
    oracleLine(3, 33.33, 0, 20),
  ];
  const tot = oracleTotals(lines);
  const { data: inv, error: iErr } = await sales.from("customer_invoices" as any).insert({
    organization_id: ORG, customer_id: CUST1, source_type: "manual",
    invoice_date: "2026-08-14", due_date: "2026-09-13", status: "validated", payment_status: "unpaid",
    payment_terms_days: 30, paid_amount: 0, remaining_amount: tot.total_ttc / 100,
    subtotal_ht: tot.subtotal_ht / 100, discount_total: (cents(7 * 99.99 * 0.1) + 0) / 100, tax_total: tot.tax_total / 100,
    total_ttc: tot.total_ttc / 100, notes: tag("multi-lines"),
  }).select("id, invoice_number").single();
  if (iErr) { ev.result("BLOCKED", "C1-invoice", iErr.message); ev.save(); process.exit(1); }
  const specs = [
    { qty: 7, price: 99.99, disc: 10, tax: 20 },
    { qty: 2, price: 149.5, disc: 0, tax: 0 },
    { qty: 3, price: 33.33, disc: 0, tax: 20 },
  ];
  let linesOk = true;
  for (let k = 0; k < specs.length; k++) {
    const s = specs[k];
    const l = lines[k];
    const gross = cents(s.qty * s.price);
    const discAmt = Math.round(gross * s.disc / 100);
    const { error: liErr } = await sales.from("customer_invoice_lines" as any).insert({
      organization_id: ORG, invoice_id: inv.id, product_id: P1, description: `L${k + 1} ${tag("line")}`,
      quantity: s.qty, unit_price_ht: s.price, discount_rate: s.disc, tax_rate_id: s.tax === 20 ? VAT20 : null, tax_rate: s.tax,
      subtotal_ht: l.subtotal_ht / 100, discount_amount: discAmt / 100, tax_amount: l.tax_amount / 100, total_ttc: l.total_ttc / 100,
    });
    if (liErr) { linesOk = false; ev.result("FAIL", `C1-line-${k + 1}`, liErr.message); }
  }
  const { data: chk } = await admin.from("customer_invoices" as any).select("subtotal_ht,tax_total,total_ttc,remaining_amount").eq("id", inv.id).single();
  const okTot = linesOk && chk
    && sameMoney(cents(chk.subtotal_ht), tot.subtotal_ht) && sameMoney(cents(chk.tax_total), tot.tax_total)
    && sameMoney(cents(chk.total_ttc), tot.total_ttc) && sameMoney(cents(chk.remaining_amount), tot.total_ttc);
  ev.result(okTot ? "PASS" : "FAIL", "C1-totaux",
    `${inv.invoice_number} oracle ${MAD(tot.subtotal_ht)} HT / ${MAD(tot.tax_total)} TVA / ${MAD(tot.total_ttc)} TTC, réel ${chk ? `${chk.subtotal_ht} / ${chk.tax_total} / ${chk.total_ttc}` : "?"}`);

  ev.section("C2. Arrondi centime (3 × 33.33 @100 TVA 20 %) — ligne oracle");
  const l2 = oracleLine(3, 33.33, 0, 20);
  ev.result(l2.subtotal_ht === 9999 && l2.tax_amount === 2000 && l2.total_ttc === 11999 ? "PASS" : "FAIL", "C2-arrondi",
    `oracle ${MAD(l2.subtotal_ht)} / ${MAD(l2.tax_amount)} / ${MAD(l2.total_ttc)} — 99.99+19.998 arrondi ligne → 119.99`);

  ev.section("C3. Surpaiement rejeté (allocation 2000 > reste 1174.92)");
  const over = await owner.rpc("create_customer_payment_atomic", {
    p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 2000,
    p_payment_date: "2026-08-14", p_idempotency_key: crypto.randomUUID(),
    p_allocations: [{ invoice_id: inv.id, amount: 2000 }], p_payment_method: "bank_transfer",
  });
  const t0 = await treasuryNow();
  ev.result(over.error ? "PASS" : "FAIL", "C3-overpay-rejected",
    over.error ? `rejeté : ${over.error.message}` : `accepté (anomalie), paiement=${JSON.stringify(over.data)}`);
  ev.result(t0.actual === t0.expected ? "PASS" : "FAIL", "C3-tresorerie-inchangee",
    `attendu ${MAD(t0.expected)}, réel ${MAD(t0.actual)}`);

  ev.section("C4. Paiements partiels + rejeu idempotent");
  const key4 = crypto.randomUUID();
  const pay1 = await owner.rpc("create_customer_payment_atomic", {
    p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 500,
    p_payment_date: "2026-08-15", p_idempotency_key: key4,
    p_allocations: [{ invoice_id: inv.id, amount: 500 }], p_payment_method: "bank_transfer",
  });
  const { data: after1 } = await admin.from("customer_invoices" as any).select("remaining_amount,payment_status").eq("id", inv.id).single();
  const okPartial = !pay1.error && cents(after1?.remaining_amount) === tot.total_ttc - 50000 && after1?.payment_status === "partial";
  ev.result(okPartial ? "PASS" : "FAIL", "C4-partial-500",
    pay1.error ? pay1.error.message : `reste ${after1.remaining_amount} (${after1.payment_status}), pay=${JSON.stringify(pay1.data)}`);

  const t1 = await treasuryNow();
  const pay1b = await owner.rpc("create_customer_payment_atomic", {
    p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: 500,
    p_payment_date: "2026-08-15", p_idempotency_key: key4,
    p_allocations: [{ invoice_id: inv.id, amount: 500 }], p_payment_method: "bank_transfer",
  });
  const t2 = await treasuryNow();
  const okReplay = pay1b.data?.[0]?.replayed === true && t2.actual === t1.actual;
  ev.result(okReplay ? "PASS" : "FAIL", "C4-replay-idempotent",
    `replay=${JSON.stringify(pay1b.data)} trésorerie avant ${MAD(t1.actual)} après ${MAD(t2.actual)}`);

  const rest = (tot.total_ttc - 50000) / 100;
  const pay2 = await owner.rpc("create_customer_payment_atomic", {
    p_organization_id: ORG, p_third_party_id: CUST1, p_treasury_account_id: BANK_MAR, p_amount: rest,
    p_payment_date: "2026-08-16", p_idempotency_key: crypto.randomUUID(),
    p_allocations: [{ invoice_id: inv.id, amount: rest }], p_payment_method: "bank_transfer",
  });
  const { data: after2 } = await admin.from("customer_invoices" as any).select("remaining_amount,payment_status,paid_amount").eq("id", inv.id).single();
  ev.result(!pay2.error && cents(after2?.remaining_amount) === 0 && after2?.payment_status === "paid" ? "PASS" : "FAIL", "C4-paid-rest",
    pay2.error ? pay2.error.message : `reste ${after2.remaining_amount} (${after2.payment_status}) payé=${after2.paid_amount}`);
  const t3 = await treasuryNow();
  ev.result(t3.actual === t3.expected ? "PASS" : "FAIL", "C4-tresorerie-oracle", `attendu ${MAD(t3.expected)}, réel ${MAD(t3.actual)}`);

  ev.section("C5. Rejeu idempotent stock (même operation_key que la réception +6)");
  const { data: receipts } = await admin.from("purchase_documents" as any).select("id").eq("organization_id", ORG).eq("document_type", "supplier_receipt");
  const recId = receipts?.[0]?.id;
  const { data: recLines } = await admin.from("purchase_document_lines" as any).select("id,quantity").eq("document_id", recId);
  const { data: p1now } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
  const { data: levelsBefore } = await admin.from("stock_levels" as any).select("quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const lvlBefore = (levelsBefore ?? []).reduce((a, lv) => a + cents(lv.quantity), 0);
  const replay = await owner.rpc("record_stock_movements_atomic", {
    p_organization_id: ORG, p_operation_key: recId,
    p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "purchase_receipt_in", direction: "in", quantity: recLines?.[0]?.quantity ?? 6, source_document_id: recId, source_line_id: recLines?.[0]?.id, movement_date: "2026-08-11" }],
    p_finalize_document_type: "supplier_receipt", p_document_id: recId,
  });
  const { data: p1after } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
  const { data: levelsAfter } = await admin.from("stock_levels" as any).select("quantity").eq("organization_id", ORG).eq("product_id", P1).eq("warehouse_id", WH_MAR);
  const lvlAfter = (levelsAfter ?? []).reduce((a, lv) => a + cents(lv.quantity), 0);
  ev.result(!replay.error && replay.data?.[0]?.replayed === true && cents(p1after?.current_stock) === cents(p1now?.current_stock) && lvlAfter === lvlBefore ? "PASS" : "FAIL", "C5-stock-replay",
    replay.error ? replay.error.message : `replay=${JSON.stringify(replay.data)} stock avant ${p1now?.current_stock} après ${p1after?.current_stock} (niveau ${lvlAfter / 100})`);

  ev.section("C6. Stock négatif refusé (delivery_out 999 u. sur stock 7)");
  const { data: bl6, error: bl6Err } = await sales.from("sales_documents" as any).insert({
    organization_id: ORG, document_type: "delivery_note", document_number: "", customer_id: CUST1,
    document_date: "2026-08-17", status: "draft", notes: tag("over-dlv"),
    subtotal_ht: 999, tax_total: 199.8, total_ttc: 1198.8,
  }).select("id").single();
  if (!bl6Err) {
    const { data: bl6Line, error: bl6lErr } = await sales.from("sales_document_lines" as any).insert({
      organization_id: ORG, document_id: bl6.id, line_order: 1, product_id: P1, description: "",
      quantity: 999, unit_price_ht: 1, discount_rate: 0, tax_rate_id: VAT20, tax_rate: 20,
      subtotal_ht: 999, tax_amount: 199.8, total_ttc: 1198.8, ordered_quantity: 999, delivered_quantity: 999, remaining_quantity: 0,
    }).select("id").single();
    const st6 = await owner.rpc("record_stock_movements_atomic", {
      p_organization_id: ORG, p_operation_key: bl6.id,
      p_movements: [{ product_id: P1, warehouse_id: WH_MAR, move_type: "delivery_out", direction: "out", quantity: 999, source_document_id: bl6.id, source_line_id: bl6Line?.id, movement_date: "2026-08-17" }],
      p_finalize_document_type: "delivery_note", p_document_id: bl6.id,
    });
    const { data: p1neg } = await admin.from("products" as any).select("current_stock").eq("id", P1).single();
    ev.result(!bl6lErr && st6.error && cents(p1neg?.current_stock) === 700 ? "PASS" : "FAIL", "C6-negative-stock",
      st6.error ? `rejeté : ${st6.error.message}` : `accepté (anomalie) — stock ${p1neg?.current_stock}`);
  } else {
    ev.result("BLOCKED", "C6-negative-stock", bl6Err.message);
  }

  ev.section("C7. Annulation de facture (montants conservés)");
  const { data: inv7, error: i7Err } = await sales.from("customer_invoices" as any).insert({
    organization_id: ORG, customer_id: CUST1, source_type: "manual",
    invoice_date: "2026-08-18", due_date: "2026-09-17", status: "validated", payment_status: "unpaid",
    payment_terms_days: 30, paid_amount: 0, remaining_amount: 500,
    subtotal_ht: 416.67, discount_total: 0, tax_total: 83.33, total_ttc: 500,
  }).select("id, invoice_number").single();
  if (i7Err) { ev.result("BLOCKED", "C7-invoice", i7Err.message); ev.save(); process.exit(1); }
  const { error: c7LineErr } = await sales.from("customer_invoice_lines" as any).insert({
    organization_id: ORG, invoice_id: inv7.id, line_order: 1, product_id: P1,
    description: "Ligne conforme C7", quantity: 1, unit_price_ht: 416.67, discount_rate: 0,
    tax_rate_id: VAT20, tax_rate: 20, subtotal_ht: 416.67, discount_amount: 0, tax_amount: 83.33, total_ttc: 500,
  });
  const { error: c7Err } = await sales.from("customer_invoices" as any).update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", inv7.id).eq("organization_id", ORG);
  const { data: chk7 } = await admin.from("customer_invoices" as any).select("status,payment_status,remaining_amount,total_ttc").eq("id", inv7.id).single();
  const ok7 = !c7LineErr && !c7Err && chk7?.status === "cancelled" && cents(chk7.remaining_amount) === 50000 && chk7.payment_status === "unpaid";
  ev.result(ok7 ? "PASS" : "FAIL", "C7-cancel-invoice",
    c7Err ? c7Err.message : `${inv7.invoice_number} statut=${chk7.status}, reste ${chk7.remaining_amount} (${chk7.payment_status}), aucun paiement`);

  const tEnd = await treasuryNow();
  ev.result(tEnd.actual === tEnd.expected ? "PASS" : "FAIL", "C-final-tresorerie-oracle", `attendu ${MAD(tEnd.expected)}, réel ${MAD(tEnd.actual)}`);

  ev.save();
})().catch((e) => { console.error(e); ev.save(); process.exit(1); });
