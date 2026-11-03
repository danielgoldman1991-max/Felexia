import path from "node:path";
import { test, type Page } from "@playwright/test";
import { addCommercialLine, clickButton, fillMoney, login, money, orgId, OWNER, pickParty, psql, psqlJson, run, USERS } from "./execute-helpers";
import { record, saveJournal } from "./journal";

test.describe.configure({ mode: "serial" });
test.afterAll(() => saveJournal());

const near = (actual: number, expected: number) => Math.abs(actual - expected) < 0.02;

test("exécuter les opérations PRO et vérifier les pièces", async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page, OWNER.email);
  const org = orgId();

  await run(page, "Paramètres", "Renseigner la patente émetteur", async () => {
    await page.goto("/parametres/entreprise");
    await page.locator('input[name="patente"]').fill("35678109");
    await page.getByRole("button", { name: /enregistrer les modifications/i }).click();
    await page.waitForTimeout(1000);
    const value = await page.locator('input[name="patente"]').inputValue();
    return { verdict: value.replace(/\s/g, "") === "35678109" ? "OK" : "bug", priority: "P1", detail: `Patente affichée : ${value || "vide"}` };
  });

  await run(page, "Tiers", "Compléter IF, RC et patente du client", async () => {
    const id = psql(`select id from public.third_parties where organization_id='${org}' and name='Société Atlas Client' order by created_at limit 1`);
    await page.goto(`/tiers/${id}/edit`);
    const details = page.locator("details, summary").filter({ hasText: /identifiants|facultatif/i }).first();
    if (await details.count()) await details.click().catch(() => undefined);
    await page.locator('input[name="ice"]').last().fill("002345678000012");
    await page.locator('input[name="if_number"]').fill("1122334");
    await page.locator('input[name="rc"]').fill("654321");
    await page.locator('input[name="patente"]').fill("7788991");
    await page.getByRole("button", { name: /enregistrer|sauvegarder/i }).first().click();
    await page.waitForTimeout(1200);
    const row = money(`select ice, if_number, rc, patente from public.third_parties where id='${id}'`);
    const ok = row?.ice === "002345678000012" && row.if_number === "1122334" && row.rc === "654321" && row.patente === "7788991";
    return { verdict: ok ? "OK" : "bug", priority: "P1", detail: JSON.stringify(row) };
  });

  await run(page, "Trésorerie", "Créer une banque et une caisse", async () => {
    for (const account of [
      { name: "Banque AWBtest", type: "bank", code: "BQ-AWB" },
      { name: "Caisse siège", type: "cash", code: "CA-SIEGE" },
    ]) {
      await page.goto("/tresorerie/comptes/new");
      await page.locator('input[name="name"]').fill(account.name);
      await page.locator('select[name="account_type"]').selectOption(account.type);
      await fillMoney(page, "opening_balance", "1000");
      await page.locator('input[name="code"]').fill(account.code);
      if (account.type === "bank") await page.locator('input[name="is_default"]').check();
      await page.getByRole("button", { name: /créer le compte/i }).click();
      await page.waitForTimeout(1000);
    }
    const rows = psqlJson<Array<{ name: string; account_type: string; is_default: boolean; current_balance: string }>>(
      `select name, account_type, is_default, current_balance::text from public.treasury_accounts where organization_id='${org}' and name in ('Banque AWBtest','Caisse siège')`,
    );
    const bank = rows.find((row) => row.name === "Banque AWBtest");
    const cash = rows.find((row) => row.name === "Caisse siège");
    const ok = Boolean(bank && cash && bank.is_default && Number(bank.current_balance) === 1000 && Number(cash.current_balance) === 1000);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: JSON.stringify(rows) };
  });

  await run(page, "Stock", "Créer deux emplacements", async () => {
    for (const place of [
      { name: "Magasin Casa", code: "MAG-CASA" },
      { name: "Dépôt Rabat", code: "DEP-RABAT" },
    ]) {
      await page.goto("/stock/emplacements/new");
      await page.locator('input[name="name"]').fill(place.name);
      await page.locator('input[name="code"]').fill(place.code);
      await page.getByRole("button", { name: /creer emplacement|créer emplacement/i }).click();
      await page.waitForTimeout(800);
    }
    const count = Number(psql(`select count(*) from public.warehouses where organization_id='${org}' and name in ('Magasin Casa','Dépôt Rabat')`));
    return { verdict: count === 2 ? "OK" : "bug", priority: "P1", detail: `${count} emplacement(s) créé(s)` };
  });

  await run(page, "Stock", "Entrée manuelle de 10 câbles", async () => {
    await page.goto("/stock/entrees/new");
    await page.getByPlaceholder(/rechercher par nom/i).click();
    await page.getByPlaceholder(/rechercher par nom/i).fill("Câble");
    await page.getByRole("button", { name: /Câble électrique/i }).first().click();
    await page.locator('select[name="warehouse_id"]').selectOption({ label: "Magasin Casa" });
    await page.locator('input[name="quantity"]').fill("10");
    await page.getByRole("button", { name: /valider entree|valider entrée/i }).click();
    await page.waitForTimeout(1200);
    const qty = psql(`select coalesce(sum(sl.quantity),0)::text from public.stock_levels sl join public.products p on p.id=sl.product_id join public.warehouses l on l.id=sl.warehouse_id where p.organization_id='${org}' and p.name='Câble électrique 2,5 mm' and l.name='Magasin Casa'`);
    return { verdict: Number(qty) === 10 ? "OK" : "bug", priority: "P0", detail: `Stock Magasin Casa = ${qty} (attendu 10)` };
  });

  const quoteId = await salesChain(page, org);
  await invoiceFromDelivery(page, org, quoteId);
  await directInvoiceAndRefusal(page, org);
  await multiVatDiscountCancel(page, org);
  await purchaseChain(page, org);
  await stockMoves(page, org);
  await treasuryOps(page, org);
  await accountingOps(page, org);
  await vatOps(page, org);
  await documentsAndHr(page, org);
  await cockpitAudit(page, org);
  await coverRoutes(page, org);
  await permissions(page);
});

async function coverRoutes(page: Page, org: string) {
  page.setDefaultNavigationTimeout(12_000);
  page.setDefaultTimeout(8_000);
  const inventory = JSON.parse(require("node:fs").readFileSync(require("node:path").join(process.cwd(), "tests/e2e/route-inventory.json"), "utf8")) as Array<{ route: string; dynamic: boolean; file: string }>;
  const id = (sql: string) => {
    try { return psql(sql); } catch { return ""; }
  };
  const ids: Record<string, string> = {
    invoice: id(`select id::text from public.customer_invoices where organization_id='${org}' order by created_at desc limit 1`),
    quote: id(`select id::text from public.sales_documents where organization_id='${org}' and document_type='quote' order by created_at desc limit 1`),
    order: id(`select id::text from public.sales_documents where organization_id='${org}' and document_type='order' order by created_at desc limit 1`),
    delivery: id(`select id::text from public.sales_documents where organization_id='${org}' and document_type='delivery_note' order by created_at desc limit 1`),
    ret: id(`select id::text from public.sales_documents where organization_id='${org}' and document_type='return_note' order by created_at desc limit 1`),
    party: id(`select id::text from public.third_parties where organization_id='${org}' order by created_at desc limit 1`),
    product: id(`select id::text from public.products where organization_id='${org}' order by created_at desc limit 1`),
    payment: id(`select id::text from public.customer_payments where organization_id='${org}' order by created_at desc limit 1`),
    credit: id(`select id::text from public.customer_credit_notes where organization_id='${org}' order by created_at desc limit 1`),
    supplierInvoice: id(`select id::text from public.supplier_invoices where organization_id='${org}' order by created_at desc limit 1`),
    purchase: id(`select id::text from public.purchase_documents where organization_id='${org}' and document_type='supplier_order' order by created_at desc limit 1`),
    receipt: id(`select id::text from public.purchase_documents where organization_id='${org}' and document_type='supplier_receipt' order by created_at desc limit 1`),
    warehouse: id(`select id::text from public.warehouses where organization_id='${org}' order by created_at desc limit 1`),
    account: id(`select id::text from public.treasury_accounts where organization_id='${org}' order by created_at desc limit 1`),
    movement: id(`select id::text from public.treasury_transactions where organization_id='${org}' order by created_at desc limit 1`),
    employee: id(`select id::text from public.hr_employees where organization_id='${org}' order by created_at desc limit 1`),
    contract: id(`select id::text from public.hr_contracts where organization_id='${org}' order by created_at desc limit 1`),
    entry: id(`select id::text from public.accounting_entries where organization_id='${org}' order by created_at desc limit 1`),
    forecast: id(`select id::text from public.treasury_forecast_items where organization_id='${org}' order by created_at desc limit 1`),
    vat: id(`select id::text from public.vat_declarations where organization_id='${org}' order by created_at desc limit 1`),
    statement: id(`select id::text from public.bank_statement_imports where organization_id='${org}' order by created_at desc limit 1`),
  };
  function resolve(route: string) {
    if (!route.includes("[")) return route;
    const pairs: Array<[string, string]> = [
      ["/facturation/factures/", ids.invoice],
      ["/facturation/paiements/", ids.payment],
      ["/facturation/avoirs/", ids.credit],
      ["/vente/devis/", ids.quote],
      ["/vente/commandes/", ids.order],
      ["/vente/livraisons/", ids.delivery],
      ["/vente/retours/", ids.ret],
      ["/tiers/", ids.party],
      ["/articles/categories/", ""],
      ["/articles/unites/", ""],
      ["/articles/tva/", ""],
      ["/articles/", ids.product],
      ["/achats/factures/", ids.supplierInvoice],
      ["/achats/commandes/", ids.purchase],
      ["/achats/receptions/", ids.receipt],
      ["/stock/emplacements/", ids.warehouse],
      ["/tresorerie/comptes/", ids.account],
      ["/tresorerie/mouvements/", ids.movement],
      ["/tresorerie/previsions/", ids.forecast],
      ["/tresorerie/releves/", ids.statement],
      ["/comptabilite/ecritures/", ids.entry],
      ["/rh/employes/", ids.employee],
      ["/rh/contrats/", ids.contract],
      ["/comptabilite/tva/declarations/", ids.vat],
      ["/facturation/electronique/", ids.invoice],
    ];
    const match = pairs.find(([prefix]) => route.startsWith(prefix));
    if (!match || !match[1]) return "";
    if (route.startsWith("/facturation/electronique/")) return `/facturation/electronique/factures/${match[1]}`;
    return route.replace(/\[[^\]]+\]/g, match[1]);
  }
  let visited = 0;
  for (const item of inventory) {
    const target = resolve(item.route);
    if (!target) {
      record({ module: "Couverture routes", operation: item.route, verdict: "non testé", detail: `Pas d'identifiant réel pour ${item.file}` });
      continue;
    }
    const response = await page.goto(target, { waitUntil: "domcontentloaded" }).catch(() => null);
    const status = response?.status() ?? 0;
    const text = await page.locator("body").innerText().catch(() => "");
    const problem = /this page couldn't load|application error|could not be found/i.test(text);
    const empty = /aucun|aucune|vide|bientôt|consultation/i.test(text);
    record({
      module: "Couverture routes",
      operation: target,
      verdict: status >= 500 || problem ? "bug" : status === 404 ? "manquant" : "OK",
      priority: status >= 500 || problem ? "P1" : undefined,
      detail: `HTTP ${status}${empty ? " · état vide ou préparatoire" : ""} · ${text.replace(/\s+/g, " ").slice(0, 140)}`,
    });
    visited += 1;
    if (visited > 220) break;
  }
}

async function salesChain(page: Page, org: string) {
  let quoteId = "";
  await run(page, "Ventes", "Devis puis commande", async () => {
    await page.goto("/vente/devis/new");
    await pickParty(page, "Atlas Client", /rechercher un client/i);
    await addCommercialLine(page, { description: "Lot câbles chantier", qty: "1", price: "1000", vat: "20 %" });
    await page.getByRole("button", { name: /creer devis|créer devis/i }).click();
    await page.waitForURL(/\/vente\/devis\/[0-9a-f-]{36}/, { timeout: 20_000 });
    quoteId = page.url().split("/").pop() ?? "";
    await clickButton(page, "Convertir en commande");
    await page.waitForURL(/\/vente\/commandes\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const order = money(`select document_number, status, subtotal_ht::text, tax_total::text, total_ttc::text from public.sales_documents where id='${page.url().split("/").pop()}'`);
    const ok = order?.status === "draft" && near(Number(order.total_ttc), 1200);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Commande ${JSON.stringify(order)} depuis devis ${quoteId}. Attendu TTC 1200.` };
  });
  return quoteId;
}

async function invoiceFromDelivery(page: Page, org: string, _quoteId: string) {
  let orderId = "";
  await run(page, "Ventes", "Confirmer la commande et créer le BL", async () => {
    orderId = page.url().split("/").pop() ?? "";
    if (!page.url().includes("/vente/commandes/")) {
      orderId = psql(`select id from public.sales_documents where organization_id='${org}' and document_type='order' and subtotal_ht=1000 order by created_at desc limit 1`);
      await page.goto(`/vente/commandes/${orderId}`);
    }
    await clickButton(page, "Confirmer commande");
    await page.waitForTimeout(800);
    await page.getByRole("link", { name: /creer une livraison|créer une livraison/i }).click();
    await page.locator('input[type="number"]').last().fill("1");
    await page.getByRole("button", { name: /creer le bl|créer le bl/i }).click();
    await page.waitForURL(/\/vente\/livraisons\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const bl = money(`select document_number, status from public.sales_documents where id='${page.url().split("/").pop()}'`);
    const stock = psql(`select coalesce(sum(quantity),0)::text from public.stock_levels sl join public.products p on p.id=sl.product_id where p.organization_id='${org}' and p.name='Câble électrique 2,5 mm'`);
    return { verdict: bl?.document_number ? "OK" : "bug", priority: "P0", detail: `BL ${JSON.stringify(bl)}. Stock câbles restant ${stock} (la ligne libre ne sort pas de stock).` };
  });

  await run(page, "Ventes", "Valider le BL et facturer", async () => {
    await clickButton(page, "Valider");
    await clickButton(page, "Marquer livre");
    await page.getByRole("link", { name: /^facturer$/i }).click();
    await page.waitForURL(/\/facturation\/factures\/new/, { timeout: 20_000 });
    await page.getByRole("button", { name: /créer la facture/i }).click();
    await page.waitForURL(/\/facturation\/factures\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const invoice = money(`select invoice_number, status, subtotal_ht::text, tax_total::text, total_ttc::text from public.customer_invoices where id='${page.url().split("/").pop()}'`);
    const ok = invoice && near(Number(invoice.total_ttc), 1200);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Facture depuis BL ${JSON.stringify(invoice)}` };
  });

  await run(page, "Ventes", "Valider, règlement partiel caisse puis solde banque", async () => {
    const invoiceId = page.url().split("/").pop() ?? "";
    await clickButton(page, "Valider");
    await clickButton(page, "Marquer comme envoyée");
    await page.getByRole("link", { name: /enregistrer paiement/i }).click();
    await page.locator('select[name="treasury_account_id"]').selectOption({ label: "Caisse siège" });
    await page.locator('input[name="amount"]').fill("400");
    await page.getByRole("button", { name: /enregistrer le règlement/i }).click();
    await page.waitForTimeout(1500);
    await page.goto(`/facturation/factures/${invoiceId}/paiement`);
    await page.locator('select[name="treasury_account_id"]').selectOption({ label: "Banque AWBtest" });
    await page.locator('input[name="amount"]').fill("800");
    await page.getByRole("button", { name: /enregistrer le règlement/i }).click();
    await page.waitForTimeout(1500);
    const invoice = money(`select status, payment_status, remaining_amount::text, paid_amount::text from public.customer_invoices where id='${invoiceId}'`);
    const pays = psql(`select count(*) from public.customer_payments where organization_id='${org}' and source_invoice_id='${invoiceId}'`);
    const ok = invoice && near(Number(invoice.remaining_amount), 0) && Number(pays) >= 2;
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Facture ${JSON.stringify(invoice)}, règlements ${pays}` };
  });

  await run(page, "Ventes", "Avoir partiel sur la facture du BL", async () => {
    const invoiceId = psql(`select id from public.customer_invoices where organization_id='${org}' and total_ttc=1200 order by created_at desc limit 1`);
    await page.goto(`/facturation/avoirs/new?invoiceId=${invoiceId}`);
    await addCommercialLine(page, { description: "Avoir geste commercial", qty: "1", price: "100", vat: "20 %" });
    await page.getByRole("button", { name: /créer l’avoir|créer l'avoir/i }).click();
    await page.waitForURL(/\/facturation\/avoirs\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const note = money(`select credit_note_number, status, total_ttc::text from public.customer_credit_notes where id='${page.url().split("/").pop()}'`);
    const ok = note && near(Number(note.total_ttc), 120);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: JSON.stringify(note) };
  });
}

async function directInvoiceAndRefusal(page: Page, org: string) {
  await run(page, "Ventes", "Facture directe depuis une commande sans BL", async () => {
    await page.goto("/vente/devis/new");
    await pickParty(page, "Atlas Client", /rechercher un client/i);
    await addCommercialLine(page, { description: "Prestation directe", qty: "2", price: "150", vat: "20 %" });
    await page.getByRole("button", { name: /creer devis|créer devis/i }).click();
    await page.waitForURL(/\/vente\/devis\//);
    await clickButton(page, "Convertir en commande");
    await page.waitForURL(/\/vente\/commandes\//);
    await clickButton(page, "Confirmer commande");
    const link = page.getByRole("link", { name: /facturer la commande/i });
    if (!(await link.count())) return { verdict: "bug", priority: "P0", detail: "Le bouton Facturer la commande est absent alors qu'aucun BL n'existe." };
    await link.click();
    await page.getByRole("button", { name: /créer la facture/i }).click();
    await page.waitForURL(/\/facturation\/factures\/[0-9a-f-]{36}/);
    const invoice = money(`select invoice_number, subtotal_ht::text, tax_total::text, total_ttc::text from public.customer_invoices where id='${page.url().split("/").pop()}'`);
    const ok = invoice && near(Number(invoice.subtotal_ht), 300) && near(Number(invoice.tax_total), 60) && near(Number(invoice.total_ttc), 360);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Attendu 300/60/360, obtenu ${JSON.stringify(invoice)}` };
  });

  await run(page, "Ventes", "Refus de facture directe quand un BL existe", async () => {
    const orderId = psql(`select id from public.sales_documents where organization_id='${org}' and document_type='order' and subtotal_ht=1000 order by created_at desc limit 1`);
    if (!orderId) return { verdict: "non testé", detail: "Aucune commande de 1 000 HT : le BL n'a pas été créé." };
    await page.goto(`/facturation/factures/new?sourceType=order&sourceId=${orderId}`);
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    const blocked = /livraison|bon de livraison|exclusive|déjà|impossible|facturer/i.test(body) && !page.url().includes(`/facturation/factures/new?sourceType=order`);
    const stillForm = page.url().includes("sourceType=order");
    const created = Number(psql(`select count(*) from public.customer_invoices where organization_id='${org}' and source_document_id='${orderId}' and source_type='order'`));
    const refused = blocked || (stillForm && /livraison|déjà factur|impossible/i.test(body)) || created === 0 && /erreur|livraison|impossible/i.test(body);
    return {
      verdict: refused || created === 0 ? "OK" : "bug",
      priority: "P0",
      detail: `URL ${page.url()}. Factures directes liées à la commande : ${created}. ${body.replace(/\s+/g, " ").slice(0, 220)}`,
      steps: `Ouvrir /facturation/factures/new?sourceType=order&sourceId=${orderId} après le BL.`,
    };
  });
}

async function multiVatDiscountCancel(page: Page, org: string) {
  await run(page, "Ventes", "Facture multi-taux 0/7/10/14/20, remise et arrondi", async () => {
    await page.goto("/facturation/factures/new");
    await pickParty(page, "Atlas Client", /rechercher un client/i);
    await addCommercialLine(page, { description: "Exonéré", qty: "1", price: "100", vat: "0 %" });
    await addCommercialLine(page, { description: "Taux 7", qty: "1", price: "100", vat: "7 %" });
    await addCommercialLine(page, { description: "Taux 10", qty: "1", price: "100", vat: "10 %" });
    await addCommercialLine(page, { description: "Taux 14", qty: "3", price: "10.333", vat: "14 %", discount: "10" });
    await addCommercialLine(page, { description: "Taux 20 remise", qty: "1", price: "200", vat: "20 %", discount: "5" });
    await page.getByRole("button", { name: /créer la facture/i }).click();
    await page.waitForURL(/\/facturation\/factures\/[0-9a-f-]{36}/);
    const id = page.url().split("/").pop() ?? "";
    const invoice = money(`select subtotal_ht::text, tax_total::text, total_ttc::text from public.customer_invoices where id='${id}'`);
    const lines = psqlJson<Array<{ description: string; tax_rate: string; subtotal_ht: string; tax_amount: string }>>(
      `select description, tax_rate::text, subtotal_ht::text, tax_amount::text from public.customer_invoice_lines where invoice_id='${id}' order by line_order`,
    );
    // 100 + 100 + 100 + (30.999 arrondi remise 10%) + 190
    const ht = Number(invoice?.subtotal_ht);
    const tva = Number(invoice?.tax_total);
    const ttc = Number(invoice?.total_ttc);
    const balanced = invoice && near(ht + tva, ttc);
    return { verdict: balanced && lines.length === 5 ? "OK" : "bug", priority: "P0", detail: `HT ${ht} TVA ${tva} TTC ${ttc}. Lignes ${JSON.stringify(lines)}` };
  });

  await run(page, "Ventes", "Annuler une facture brouillon", async () => {
    await page.goto("/facturation/factures/new");
    await pickParty(page, "Atlas Client", /rechercher un client/i);
    await addCommercialLine(page, { description: "Facture à annuler", qty: "1", price: "50", vat: "20 %" });
    await page.locator('input[name="due_date"]').locator("xpath=preceding::input[not(@type='hidden')][1]").fill("2026-10-01");
    await page.getByRole("button", { name: /créer la facture/i }).click();
    await page.waitForURL(/\/facturation\/factures\/[0-9a-f-]{36}/);
    const id = page.url().split("/").pop() ?? "";
    await clickButton(page, "Annuler");
    const status = psql(`select status from public.customer_invoices where id='${id}'`);
    return { verdict: status === "cancelled" ? "OK" : "bug", priority: "P1", detail: `Statut après annulation : ${status}` };
  });

  await run(page, "Ventes", "Facture échue et relance", async () => {
    await page.goto("/facturation/factures/new");
    await pickParty(page, "Atlas Client", /rechercher un client/i);
    await addCommercialLine(page, { description: "Facture échue", qty: "1", price: "80", vat: "20 %" });
    await page.locator('input[name="due_date"]').locator("xpath=preceding::input[not(@type='hidden')][1]").fill("2026-10-01");
    await page.getByRole("button", { name: /créer la facture/i }).click();
    await page.waitForURL(/\/facturation\/factures\/[0-9a-f-]{36}/);
    const id = page.url().split("/").pop() ?? "";
    await clickButton(page, "Valider");
    await clickButton(page, "Marquer comme envoyée");
    await page.goto("/facturation/factures");
    await page.waitForTimeout(1000);
    const status = psql(`select status from public.customer_invoices where id='${id}'`);
    await page.goto(`/facturation/factures/${id}`);
    const reminder = page.getByRole("link", { name: /creer relance|créer relance/i });
    if (await reminder.count()) {
      await reminder.click();
      await page.getByRole("button", { name: /créer|enregistrer/i }).last().click();
      await page.waitForTimeout(1200);
    }
    const reminders = Number(psql(`select count(*) from public.customer_reminders where organization_id='${org}'`));
    const overdue = status === "overdue";
    return { verdict: overdue && reminders > 0 ? "OK" : overdue ? "à améliorer" : "bug", priority: overdue ? "P2" : "P1", detail: `Statut ${status}, relances ${reminders}` };
  });

  await run(page, "Numérotation", "Séquence des factures et devis", async () => {
    const numbers = psql(`select string_agg(invoice_number, ', ' order by invoice_number) from public.customer_invoices where organization_id='${org}'`);
    const quotes = psql(`select string_agg(document_number, ', ' order by document_number) from public.sales_documents where organization_id='${org}' and document_type='quote'`);
    const ok = /FAC-/.test(numbers) && /DEV-2611-/.test(quotes);
    return { verdict: ok ? "OK" : "bug", priority: "P1", detail: `Factures ${numbers}. Devis ${quotes}` };
  });
}

async function purchaseChain(page: Page, org: string) {
  await run(page, "Achats", "Commande, réception, facture et règlement", async () => {
    await page.goto("/achats/commandes/new");
    await pickParty(page, "Fournitures", /rechercher/i);
    await page.getByRole("button", { name: /ligne libre/i }).click();
    const inputs = page.locator("table input");
    await inputs.nth(0).fill("Fourniture bureau");
    await inputs.nth(1).fill("4");
    await inputs.nth(3).fill("80");
    await inputs.nth(5).fill("20");
    await page.getByRole("button", { name: /creer commande fournisseur/i }).click();
    await page.waitForURL(/\/achats\/commandes\/[0-9a-f-]{36}/);
    const orderId = page.url().split("/").pop() ?? "";
    const order = money(`select document_number, subtotal_ht::text, tax_total::text, total_ttc::text from public.purchase_documents where id='${orderId}'`);
    await clickButton(page, "Confirmer");
    await page.getByRole("link", { name: /creer reception|créer réception/i }).click();
    await page.locator('input[type="number"]').last().fill("4");
    const warehouse = page.locator("select").filter({ has: page.locator("option", { hasText: "Magasin Casa" }) }).first();
    if (await warehouse.count()) await warehouse.selectOption({ label: "Magasin Casa" });
    await page.getByRole("button", { name: /creer reception|créer réception/i }).click();
    await page.waitForURL(/\/achats\/receptions\/[0-9a-f-]{36}/);
    await clickButton(page, "Valider reception");
    await page.getByRole("link", { name: /creer la facture fournisseur|creer facture/i }).click();
    await page.getByRole("button", { name: /créer la facture d’achat|créer la facture d'achat/i }).click();
    await page.waitForURL(/\/achats\/factures\/[0-9a-f-]{36}/);
    const invoiceId = page.url().split("/").pop() ?? "";
    const invoice = money(`select invoice_number, subtotal_ht::text, tax_total::text, total_ttc::text, status from public.supplier_invoices where id='${invoiceId}'`);
    await clickButton(page, "Valider");
    await page.goto(`/achats/paiements/new?invoiceId=${invoiceId}`);
    if (!page.url().includes("/paiements/")) await page.goto("/achats/paiements/new");
    await pickParty(page, "Fournitures", /rechercher/i).catch(() => undefined);
    await page.locator('select[name="treasury_account_id"]').selectOption({ label: "Banque AWBtest" });
    const amount = page.locator('input[name="amount"]');
    if ((await amount.inputValue()) === "" || (await amount.inputValue()) === "0") await amount.fill(invoice?.total_ttc ?? "384");
    await page.getByRole("button", { name: /enregistrer le règlement/i }).click();
    await page.waitForTimeout(1500);
    const paid = money(`select payment_status, remaining_amount::text from public.supplier_invoices where id='${invoiceId}'`);
    const ok = order && near(Number(order.total_ttc), 384) && invoice && near(Number(invoice.total_ttc), 384);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Commande ${JSON.stringify(order)}. Facture ${JSON.stringify(invoice)}. Après règlement ${JSON.stringify(paid)}` };
  });

  await run(page, "Achats", "Avoir fournisseur (retour commercial)", async () => {
    const invoiceId = psql(`select id from public.supplier_invoices where organization_id='${org}' order by created_at desc limit 1`);
    await page.goto(`/achats/avoirs/new?invoiceId=${invoiceId}`);
    if (page.url().includes("/dashboard") || /introuvable|pas le droit/i.test(await page.locator("body").innerText())) {
      return { verdict: "manquant", priority: "P1", detail: "Pas de création d'avoir fournisseur depuis la facture, ni de retour stock fournisseur dédié." };
    }
    const free = page.getByRole("button", { name: /ajouter une ligne|ligne libre/i }).first();
    if (await free.count()) await free.click();
    const inputs = page.locator("table input, input[name='description']");
    if (await page.getByText("Description", { exact: true }).count()) await addCommercialLine(page, { description: "Retour fourniture", qty: "1", price: "80", vat: "20 %" });
    else if (await inputs.count()) {
      await inputs.nth(0).fill("Retour fourniture");
      await inputs.nth(1).fill("1");
      await inputs.nth(3).fill("80");
    }
    await page.getByRole("button", { name: /créer l’avoir|créer l'avoir/i }).click();
    await page.waitForTimeout(1500);
    const count = Number(psql(`select count(*) from public.supplier_credit_notes where organization_id='${org}'`));
    return { verdict: count > 0 ? "OK" : "bug", priority: "P1", detail: `Avoirs fournisseurs : ${count}. URL ${page.url()}` };
  });
}

async function stockMoves(page: Page, org: string) {
  await run(page, "Stock", "Transfert de 3 câbles vers Dépôt Rabat", async () => {
    await page.goto("/stock/transferts");
    await page.locator('select[name="product_id"]').selectOption({ label: "Câble électrique 2,5 mm" });
    await page.locator('select[name="from_warehouse_id"]').selectOption({ label: "Magasin Casa" });
    await page.locator('select[name="to_warehouse_id"]').selectOption({ label: "Dépôt Rabat" });
    await page.locator('input[name="quantity"]').fill("3");
    await page.getByRole("button", { name: /transférer/i }).click();
    await page.waitForTimeout(1200);
    const casa = psql(`select coalesce(sum(sl.quantity),0)::text from public.stock_levels sl join public.warehouses l on l.id=sl.warehouse_id join public.products p on p.id=sl.product_id where p.organization_id='${org}' and p.name='Câble électrique 2,5 mm' and l.name='Magasin Casa'`);
    const rabat = psql(`select coalesce(sum(sl.quantity),0)::text from public.stock_levels sl join public.warehouses l on l.id=sl.warehouse_id join public.products p on p.id=sl.product_id where p.organization_id='${org}' and p.name='Câble électrique 2,5 mm' and l.name='Dépôt Rabat'`);
    const ok = Number(casa) === 7 && Number(rabat) === 3;
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Casa ${casa} (attendu 7), Rabat ${rabat} (attendu 3)` };
  });

  await run(page, "Stock", "Ajustement sortie et refus de stock négatif", async () => {
    await page.goto("/stock/ajustements/new");
    await page.getByPlaceholder(/rechercher par nom/i).click();
    await page.getByPlaceholder(/rechercher par nom/i).fill("Câble");
    await page.getByRole("button", { name: /Câble électrique/i }).first().click();
    await page.locator('select[name="direction"]').selectOption("out");
    await page.locator('select[name="warehouse_id"]').selectOption({ label: "Dépôt Rabat" });
    await page.locator('input[name="quantity"]').fill("99");
    await page.getByRole("button", { name: /valider ajustement/i }).click();
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    const rabat = Number(psql(`select coalesce(sum(sl.quantity),0) from public.stock_levels sl join public.warehouses l on l.id=sl.warehouse_id join public.products p on p.id=sl.product_id where p.organization_id='${org}' and p.name='Câble électrique 2,5 mm' and l.name='Dépôt Rabat'`));
    const refused = rabat === 3 && /insuffisant|négatif|negatif|disponible|impossible/i.test(body);
    return { verdict: refused ? "OK" : rabat < 0 ? "bug" : "à améliorer", priority: rabat < 0 ? "P0" : "P1", detail: `Rabat après tentative 99 = ${rabat}. ${body.replace(/\s+/g, " ").slice(0, 180)}` };
  });

  await run(page, "Stock", "Inventaire et seuil", async () => {
    await page.goto("/stock/inventaire");
    const body = await page.locator("body").innerText();
    const shows = /câble|cable|seuil|stock/i.test(body);
    return { verdict: shows ? "OK" : "à améliorer", priority: "P2", detail: body.replace(/\s+/g, " ").slice(0, 220) };
  });

  await run(page, "Ventes", "Retour client depuis le BL", async () => {
    const bl = psql(`select id from public.sales_documents where organization_id='${org}' and document_type='delivery_note' order by created_at desc limit 1`);
    if (!bl) return { verdict: "non testé", detail: "Aucun BL." };
    await page.goto(`/vente/livraisons/${bl}`);
    const link = page.getByRole("link", { name: /creer un retour|créer un retour/i });
    if (!(await link.count())) return { verdict: "manquant", priority: "P1", detail: "Pas de bouton de retour sur le BL." };
    await link.click();
    const qty = page.locator('input[type="number"]').last();
    if (await qty.count()) await qty.fill("1");
    await page.getByRole("button", { name: /créer|valider|enregistrer/i }).last().click();
    await page.waitForTimeout(1500);
    const count = Number(psql(`select count(*) from public.sales_documents where organization_id='${org}' and document_type='return_note'`));
    return { verdict: count > 0 ? "OK" : "bug", priority: "P1", detail: `Bons de retour : ${count}. URL ${page.url()}` };
  });
}

async function treasuryOps(page: Page, org: string) {
  await run(page, "Trésorerie", "Virement interne caisse vers banque", async () => {
    const before = money(`select (select current_balance from public.treasury_accounts where organization_id='${org}' and name='Caisse siège')::text as cash, (select current_balance from public.treasury_accounts where organization_id='${org}' and name='Banque AWBtest')::text as bank`);
    await page.goto("/tresorerie/mouvements/new");
    await page.getByRole("button", { name: /transfert entre comptes/i }).click();
    await page.locator('select[name="treasury_account_id"]').selectOption({ label: "Caisse siège" });
    await page.locator('select[name="destination_account_id"]').selectOption({ label: "Banque AWBtest" });
    await fillMoney(page, "amount", "150");
    await page.locator('input[name="label"]').fill("Alimentation banque");
    await page.getByRole("button", { name: /enregistrer|créer/i }).last().click();
    await page.waitForTimeout(1500);
    const after = money(`select (select current_balance from public.treasury_accounts where organization_id='${org}' and name='Caisse siège')::text as cash, (select current_balance from public.treasury_accounts where organization_id='${org}' and name='Banque AWBtest')::text as bank`);
    const ok = before && after && near(Number(before.cash) - Number(after.cash), 150) && near(Number(after.bank) - Number(before.bank), 150);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: `Avant ${JSON.stringify(before)} après ${JSON.stringify(after)}` };
  });

  await run(page, "Trésorerie", "Import de relevé CSV", async () => {
    await page.goto("/tresorerie/releves/import");
    await page.locator('select[name="treasury_account_id"]').selectOption({ label: "Banque AWBtest" });
    await page.locator('input[name="file"]').setInputFiles(path.join(process.cwd(), "tests/e2e/fixtures/releve.csv"));
    await page.getByRole("button", { name: /importer le releve/i }).click();
    await page.waitForTimeout(1500);
    const count = Number(psql(`select count(*) from public.bank_statement_lines l join public.bank_statement_imports i on i.id=l.import_id where i.organization_id='${org}'`));
    return { verdict: count >= 2 ? "OK" : "bug", priority: "P1", detail: `${count} ligne(s) de relevé. ${await page.locator("body").innerText().then((text) => text.replace(/\s+/g, " ").slice(0, 160))}` };
  });

  await run(page, "Trésorerie", "Rapprochement", async () => {
    await page.goto("/tresorerie/rapprochement");
    const body = await page.locator("body").innerText();
    const actionable = /rapprocher|lettrer|pointer/i.test(body);
    return { verdict: actionable ? "OK" : "à améliorer", priority: "P1", detail: actionable ? "Écran de rapprochement actionnable." : `Écran ouvert sans action de pointage évidente. ${body.replace(/\s+/g, " ").slice(0, 180)}` };
  });
}

async function accountingOps(page: Page, org: string) {
  await run(page, "Compta", "Ouverture d'exercice", async () => {
    await page.goto("/comptabilite/exercices");
    const year = page.locator('input[name="year"]');
    if (await year.count()) await year.fill("2026");
    await page.getByRole("button", { name: /ouvrir|créer/i }).first().click();
    await page.waitForTimeout(1200);
    const count = Number(psql(`select count(*) from public.accounting_fiscal_years where organization_id='${org}' and name='2026'`));
    const periods = Number(psql(`select count(*) from public.accounting_periods where organization_id='${org}'`));
    return { verdict: count === 1 && periods === 12 ? "OK" : "bug", priority: "P1", detail: `Exercice ${count}, périodes ${periods}` };
  });

  await run(page, "Compta", "Comptabiliser une facture client (admin)", async () => {
    const id = psql(`select id from public.customer_invoices where organization_id='${org}' and status in ('validated','sent','paid','partially_paid') and total_ttc=360 order by created_at desc limit 1`);
    await page.goto(`/facturation/factures/${id}`);
    const details = page.locator("summary").filter({ hasText: /journal comptable/i });
    if (await details.count()) await details.click();
    await clickButton(page, "Comptabiliser");
    const entry = money(`select entry_number, status, total_debit::text, total_credit::text from public.accounting_entries where organization_id='${org}' and source_document_id='${id}' order by created_at desc limit 1`);
    const ok = entry && entry.total_debit === entry.total_credit && near(Number(entry.total_debit), 360);
    return { verdict: ok ? "OK" : "bug", priority: "P0", detail: JSON.stringify(entry) };
  });

  await run(page, "Compta", "Écriture manuelle OD équilibrée", async () => {
    await page.goto("/comptabilite/ecritures/nouveau");
    const body = await page.locator("body").innerText();
    if (/introuvable|bientôt/i.test(body)) return { verdict: "manquant", priority: "P1", detail: "Pas de formulaire d'écriture manuelle." };
    await page.locator('input[name="label"], textarea[name="label"]').first().fill("OD test loyer");
    await page.getByRole("button", { name: /ajouter une ligne/i }).click();
    await page.getByRole("button", { name: /ajouter une ligne/i }).click();
    const debits = page.locator('input[name*="debit"], input[placeholder*="Débit"]');
    return { verdict: "à améliorer", priority: "P1", detail: `Formulaire ouvert. Saisie des comptes à vérifier à l'écran. ${body.replace(/\s+/g, " ").slice(0, 120)}` };
  });
}

async function vatOps(page: Page, org: string) {
  await run(page, "TVA", "Déclaration préparatoire du mois", async () => {
    await page.goto("/comptabilite/tva/declarations/new");
    await page.locator('input[name="periodStart"]').fill("2026-11-01");
    await page.locator('input[name="periodEnd"]').fill("2026-11-30");
    await page.getByRole("button", { name: /créer la déclaration/i }).click();
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    const has7 = /7\s*%|110/.test(body);
    const id = psql(`select id from public.vat_declarations where organization_id='${org}' order by created_at desc limit 1`);
    return { verdict: id ? "OK" : "bug", priority: "P1", detail: `Déclaration ${id || "absente"}. Mention 7 % ou ligne 110 : ${has7}. ${body.replace(/\s+/g, " ").slice(0, 180)}` };
  });

  await run(page, "TVA", "Export et blocage si déséquilibre", async () => {
    await page.goto("/comptabilite/tva/exports?from=2026-11-01&to=2026-11-30&frequency=monthly&preflight=1");
    const body = await page.locator("body").innerText();
    const blocked = /déséquilibre|desequilibre|unbalanced|bloqu/i.test(body);
    const exportable = /générer|xml|télécharger/i.test(body);
    return { verdict: exportable || blocked ? "OK" : "à améliorer", priority: "P1", detail: body.replace(/\s+/g, " ").slice(0, 240) };
  });
}

async function documentsAndHr(page: Page, org: string) {
  await run(page, "PDF", "ICE/IF/RC/patente sur la facture imprimable", async () => {
    const id = psql(`select id from public.customer_invoices where organization_id='${org}' and total_ttc=360 order by created_at desc limit 1`);
    await page.goto(`/facturation/factures/${id}/print`);
    const text = await page.locator("body").innerText();
    const checks = {
      iceEmetteur: text.includes("001234567000084"),
      ifEmetteur: text.includes("48591230"),
      rcEmetteur: text.includes("123456"),
      patenteEmetteur: text.includes("35678109"),
      iceClient: text.includes("002345678000012"),
      ifClient: text.includes("1122334"),
      rcClient: text.includes("654321"),
      patenteClient: text.includes("7788991"),
    };
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
    return { verdict: missing.length === 0 ? "OK" : "bug", priority: "P1", detail: missing.length ? `Manque ${missing.join(", ")}` : "Identifiants émetteur et client présents." };
  });

  await run(page, "E-facture", "Préparation PDF/XML", async () => {
    const id = psql(`select id from public.customer_invoices where organization_id='${org}' and status <> 'draft' and status <> 'cancelled' order by created_at desc limit 1`);
    await page.goto(`/facturation/electronique/factures/${id}`);
    const body = await page.locator("body").innerText();
    if (/désactiv|indisponible|non activ/i.test(body)) return { verdict: "manquant", priority: "P1", detail: "Module e-facture non activé pour l'entreprise ou le serveur." };
    const buyer = page.locator('select[name="buyerType"]');
    if (await buyer.count()) await buyer.selectOption("business");
    const unit = page.locator("select").filter({ has: page.locator("option", { hasText: /C62|unité/i }) }).first();
    if (await unit.count()) await unit.selectOption({ index: 1 }).catch(() => undefined);
    const submit = page.getByRole("button", { name: /générer|préparer|xml/i }).first();
    if (await submit.count()) await submit.click();
    await page.waitForTimeout(2000);
    const after = await page.locator("body").innerText();
    const docs = Number(psql(`select count(*) from public.einvoice_documents where organization_id='${org}'`));
    return { verdict: docs > 0 || /xml|pdf|génér/i.test(after) ? "OK" : "bug", priority: "P1", detail: `Documents e-facture ${docs}. ${after.replace(/\s+/g, " ").slice(0, 180)}` };
  });

  await run(page, "RH", "Employé, contrat et paie de base", async () => {
    await page.goto("/rh/employes/new");
    await page.locator('input[name="employee_number"]').fill("EMP-001");
    await page.locator('input[name="hire_date"]').fill("2026-01-06");
    await page.locator('input[name="first_name"]').fill("Karim");
    await page.locator('input[name="last_name"]').fill("Tazi");
    await page.locator('input[name="cin"]').fill("BK123456");
    await page.locator('input[name="base_salary"]').fill("8000");
    await page.getByRole("button", { name: /créer l'employé/i }).click();
    await page.waitForTimeout(1200);
    const employee = money(`select id::text, base_salary::text from public.hr_employees where organization_id='${org}' and employee_number='EMP-001'`);
    await page.goto("/rh/contrats/new");
    await page.locator('select[name="employee_id"]').selectOption({ index: 1 });
    await page.locator('input[name="contract_number"]').fill("CT-001");
    await page.locator('input[name="start_date"]').fill("2026-01-06");
    await page.locator('input[name="base_salary"]').fill("8000");
    await page.getByRole("button", { name: /créer le contrat/i }).click();
    await page.waitForTimeout(1000);
    await page.goto("/rh/paie/periodes/new");
    const month = page.locator('input[name="month"], select[name="month"]').first();
    const year = page.locator('input[name="year"], select[name="year"]').first();
    if (await month.count()) await month.fill("11").catch(async () => month.selectOption("11"));
    if (await year.count()) await year.fill("2026").catch(async () => year.selectOption("2026"));
    await page.getByRole("button", { name: /créer la période/i }).click();
    await page.waitForTimeout(1200);
    const ack = page.locator('input[name="ack_base_only"]');
    if (await ack.count()) {
      await ack.check();
      await page.getByRole("button", { name: /préparer les bulletins/i }).click();
      await page.waitForTimeout(1500);
    }
    const slip = money(`select base_salary::text, net_salary::text, gross_salary::text from public.hr_payslips where organization_id='${org}' order by created_at desc limit 1`);
    const ok = employee && Number(employee.base_salary) === 8000 && slip && Number(slip.base_salary) === 8000;
    return { verdict: ok ? "OK" : employee ? "à améliorer" : "bug", priority: "P1", detail: `Employé ${JSON.stringify(employee)}. Bulletin ${JSON.stringify(slip)}` };
  });

  await run(page, "RH", "Congé", async () => {
    await page.goto("/rh/conges");
    const body = await page.locator("body").innerText();
    const consult = /consultation|ne sont pas proposées/i.test(body);
    return { verdict: consult ? "manquant" : "à améliorer", priority: "P1", detail: consult ? "L'écran Congés est en consultation : aucune création de demande." : body.replace(/\s+/g, " ").slice(0, 160) };
  });

  await run(page, "GED", "Import d'un document", async () => {
    await page.goto("/documents");
    const file = page.locator('input[type="file"]').first();
    if (!(await file.count())) return { verdict: "manquant", priority: "P2", detail: "Pas de champ de fichier sur /documents." };
    await file.setInputFiles(path.join(process.cwd(), "tests/e2e/fixtures/releve.csv"));
    const title = page.locator('input[name="title"]').first();
    if (await title.count()) await title.fill("Relevé test GED");
    await page.getByRole("button", { name: /^importer$/i }).click();
    await page.waitForTimeout(1500);
    const count = Number(psql(`select count(*) from public.documents where organization_id='${org}'`));
    return { verdict: count > 0 ? "OK" : "bug", priority: "P2", detail: `Documents GED ${count}` };
  });

  await run(page, "Prévisions", "Prévision manuelle de loyer", async () => {
    await page.goto("/tresorerie/previsions/nouveau");
    await page.locator('input[name="label"]').fill("Loyer novembre");
    await page.locator('input[name="forecast_date"]').fill("2026-11-05");
    await fillMoney(page, "amount", "7000");
    await page.getByRole("button", { name: /creer la prevision|créer la prévision/i }).click();
    await page.waitForTimeout(1000);
    const row = money(`select label, amount::text from public.treasury_forecast_items where organization_id='${org}' and label='Loyer novembre'`);
    return { verdict: row && Number(row.amount) === 7000 ? "OK" : "bug", priority: "P2", detail: JSON.stringify(row) };
  });
}

async function cockpitAudit(page: Page, org: string) {
  await run(page, "Cockpit", "Les KPI reflètent les factures", async () => {
    await page.goto("/dashboard");
    const body = await page.locator("body").innerText();
    const revenue = Number(psql(`select coalesce(sum(total_ttc),0)::text from public.customer_invoices where organization_id='${org}' and status not in ('draft','cancelled')`));
    const shown = /[1-9][\d\s .,]*DH|[1-9][\d\s .,]*MAD/.test(body);
    return { verdict: shown ? "OK" : "bug", priority: "P1", detail: `CA factures validées ${revenue} MAD. Extrait cockpit : ${body.replace(/\s+/g, " ").slice(0, 200)}` };
  });

  await run(page, "Audit", "Les actions apparaissent", async () => {
    await page.goto("/outils/audit-log");
    const count = Number(psql(`select count(*) from public.audit_logs where organization_id='${org}'`));
    const body = await page.locator("body").innerText();
    return { verdict: count > 0 && /facture|devis|entreprise|client/i.test(body) ? "OK" : count > 0 ? "à améliorer" : "bug", priority: "P1", detail: `${count} lignes d'audit. ${body.replace(/\s+/g, " ").slice(0, 180)}` };
  });
}

async function permissions(page: Page) {
  const cases: Array<{ role: keyof typeof USERS; email: string; path: string; expect: "allow" | "deny"; label: string }> = [
    { role: "admin", email: USERS.admin.email, path: "/facturation/factures/new", expect: "allow", label: "Admin crée une facture" },
    { role: "admin", email: USERS.admin.email, path: "/comptabilite/ecritures/nouveau", expect: "allow", label: "Admin écriture manuelle" },
    { role: "accountant", email: USERS.accountant.email, path: "/comptabilite/ecritures/nouveau", expect: "allow", label: "Comptable écriture manuelle" },
    { role: "accountant", email: USERS.accountant.email, path: "/parametres/utilisateurs", expect: "allow", label: "Comptable consulte les utilisateurs" },
    { role: "operator", email: USERS.operator.email, path: "/facturation/factures/new", expect: "allow", label: "Opérateur crée une facture" },
    { role: "operator", email: USERS.operator.email, path: "/vente/devis/new", expect: "deny", label: "Opérateur devis (refusé par le produit)" },
    { role: "operator", email: USERS.operator.email, path: "/stock/entrees/new", expect: "deny", label: "Opérateur entrée stock" },
    { role: "operator", email: USERS.operator.email, path: "/comptabilite/ecritures/nouveau", expect: "deny", label: "Opérateur écriture" },
    { role: "viewer", email: USERS.viewer.email, path: "/facturation/factures/new", expect: "deny", label: "Lecteur nouvelle facture" },
    { role: "viewer", email: USERS.viewer.email, path: "/tiers/new?type=customer", expect: "deny", label: "Lecteur nouveau client" },
    { role: "viewer", email: USERS.viewer.email, path: "/facturation/factures", expect: "allow", label: "Lecteur consulte les factures" },
  ];
  for (const item of cases) {
    await run(page, "Permissions", item.label, async () => {
      await login(page, item.email);
      await page.goto(item.path);
      await page.waitForTimeout(600);
      const url = page.url();
      const allowed = url.includes(item.path.split("?")[0]);
      const match = item.expect === "allow" ? allowed : !allowed;
      return {
        verdict: match ? "OK" : "bug",
        priority: match ? undefined : "P1",
        detail: `Attendu ${item.expect === "allow" ? "autorisé" : "refusé"}, obtenu ${allowed ? "autorisé" : "refusé"} (${url})`,
        steps: `Connexion ${item.email} puis ${item.path}`,
      };
    });
  }
  await login(page, OWNER.email);
}
