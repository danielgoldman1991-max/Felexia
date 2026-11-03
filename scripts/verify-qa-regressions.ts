import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCustomerInvoiceLines,
  buildSupplierInvoiceLines,
} from "../src/lib/accounting";
import { DOCUMENT_STATUSES } from "../src/lib/document-types";
import { computeWeightedAmount } from "../src/lib/treasury/treasury-forecast";
import { canonicalMoney, parseLocalizedMoney } from "../src/lib/money";
import { synchronizeSingleInvoiceAllocation } from "../src/lib/payment-amount-allocation";
import { resolveSeedLineParents } from "./lib/seed-line-parents";
import { getDefaultTrialEndDate, getBusinessTrialEndDate } from "../src/lib/subscriptions/trial-config";
import { calculateCommercialAmounts, calculateInvoiceTotals, calculateInvoiceLine, summarizeVatByRate } from "../src/lib/invoice-calculations";
import { calculateLine } from "../src/lib/commerce-calculations";
import { buildDeclarationLines, vatDeclarationImbalance } from "../src/lib/tax/dgi-vat-mapping";
import { canLetterLines } from "../src/lib/accounting-lettering";
import { isBaseOnlyPayrollAcknowledgement, PERSISTED_PAYROLL_SCOPE } from "../src/lib/hr/payroll-engine";
import { hasValidSubscriptionAccess } from "../src/lib/subscriptions/subscription-access";
import { canAccessFeature } from "../src/lib/subscriptions/plan-access";
import { calculateMoroccanPayslip2026, seniorityRate } from "../src/lib/hr/ma-payroll-2026";
import { computeCump } from "../src/lib/stock/cump";
import { buildFinancialStatements } from "../src/lib/accounting/financial-statements";
import { agingBucket } from "../src/lib/sales/aged-receivables";
import { matchPurchase } from "../src/lib/purchases/three-way-match";

const accountingLines = buildCustomerInvoiceLines([
  {
    product_id: "product-1",
    product_name: "Produit remisé",
    description: "Produit remisé",
    subtotal_ht: 880,
    discount_amount: 20,
    tax_amount: 176,
    total_ttc: 1056,
    tax_rate: 20,
  },
], {
  sales_product: "sales-product",
  sales_service: "sales-service",
  customer: "customer",
  sales_vat: "vat",
});

assert.equal(accountingLines.find((line) => line.account_id === "sales-product")?.credit, 880, "La remise client ne doit pas être déduite deux fois.");
assert.equal(accountingLines.find((line) => line.account_id === "customer")?.debit, 1056, "La créance client doit correspondre au TTC.");

const supplierAccountingLines = buildSupplierInvoiceLines(
  [
    {
      product_id: "product-1",
      product_name: "Achat remisé",
      description: "Achat remisé",
      subtotal_ht: 1_000,
      discount_amount: 20,
      tax_amount: 196,
      total_ttc: 1_176,
      tax_rate: 20,
    },
  ],
  {
    purchase_product: "purchase-product",
    purchase_service: "purchase-service",
    supplier: "supplier",
    purchase_vat: "purchase-vat",
  },
);
assert.equal(
  supplierAccountingLines.find((line) => line.account_id === "purchase-product")?.debit,
  980,
  "La remise fournisseur doit être déduite une seule fois du sous-total brut.",
);
assert.equal(
  supplierAccountingLines.find((line) => line.account_id === "supplier")?.credit,
  1_176,
  "La dette fournisseur doit correspondre au TTC.",
);
assert.equal(computeWeightedAmount(600, 100, "outflow", "realistic"), 600, "Une probabilité de 100 % ne doit pas multiplier le montant par 100.");
assert.equal(parseLocalizedMoney("600,00"), 600, "Une saisie française ne doit pas être convertie en centimes.");
assert.equal(canonicalMoney("600,00"), "600.00", "Le serveur doit recevoir une valeur décimale canonique.");
const singleSale = [{ id: "sale", remaining_amount: 240 }];
assert.deepEqual(synchronizeSingleInvoiceAllocation({ sale: 240 }, 100, singleSale), { sale: 100 }, "Un règlement partiel de 100 doit affecter 100 à la facture de 240.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({ sale: 100 }, 300, singleSale), { sale: 240 }, "Un versement de 300 doit solder 240 et conserver 60 disponibles, sans suraffectation.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({ sale: 240 }, 0, singleSale), { sale: 0 }, "Effacer le montant ne doit pas conserver une affectation positive.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({ sale: 0 }, 140, [{ id: "sale", remaining_amount: 140 }]), { sale: 140 }, "Le règlement suivant doit pouvoir solder les 140 restants.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({ purchase: 120 }, 50, [{ id: "purchase", remaining_amount: 120 }]), { purchase: 50 }, "Le même comportement partiel doit s'appliquer aux achats.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({ sale: 240, other: 0 }, 100, singleSale), { sale: 100 }, "Une ancienne ligne à zéro ne doit pas empêcher le règlement partiel de l'unique facture sélectionnée.");
const multipleAllocations = { sale: 100, other: 40 };
assert.equal(synchronizeSingleInvoiceAllocation(multipleAllocations, 80, singleSale), multipleAllocations, "Les affectations de plusieurs factures doivent conserver la répartition manuelle.");
assert.deepEqual(synchronizeSingleInvoiceAllocation({}, 60, singleSale), {}, "Une avance libre doit rester non affectée.");
assert.equal(parseLocalizedMoney("1 290,50"), 1_290.5, "Les séparateurs de milliers français doivent être acceptés.");
assert.equal(DOCUMENT_STATUSES.filter((status) => status.label === "Disponible").length, 1, "Le filtre Disponible ne doit apparaître qu'une fois.");

const treasuryActionsSource = readFileSync(
  new URL("../src/lib/treasury-actions.ts", import.meta.url),
  "utf8",
);
assert.match(
  treasuryActionsSource,
  /create_treasury_transaction_atomic/,
  "Les mouvements manuels doivent passer par l'operation atomique.",
);
assert.match(
  treasuryActionsSource,
  /archive_treasury_transaction_atomic/,
  "L'archivage d'un mouvement doit inverser le solde dans la meme transaction SQL.",
);
assert.doesNotMatch(
  treasuryActionsSource,
  /from\("treasury_transactions"\)\.insert/,
  "Aucune insertion de tresorerie applicative ne doit contourner les RPC atomiques.",
);

const integrityMigrationSource = readFileSync(
  new URL(
    "../supabase/migrations/20260810213138_fix_erp_integrity_and_transfers.sql",
    import.meta.url,
  ),
  "utf8",
);
assert.match(
  integrityMigrationSource,
  /when old\.transaction_type = 'opening_balance' then 0/,
  "Le solde initial ne doit pas etre comptabilise une seconde fois par le trigger.",
);
assert.match(
  integrityMigrationSource,
  /idempotency_key uuid/,
  "Les ecritures financieres critiques doivent accepter une cle d'idempotence.",
);
assert.match(
  integrityMigrationSource,
  /record_stock_movements_atomic/,
  "Les mouvements de stock doivent etre regroupes dans une operation atomique et idempotente.",
);
assert.match(
  integrityMigrationSource,
  /La ligne source de reception fournisseur est incoherente/,
  "Le trigger de stock doit refuser une ligne de reception sans parent exact.",
);

const stockApplicationSources = [
  "../src/lib/product-actions.ts",
  "../src/lib/purchase-actions.ts",
  "../src/lib/sales-actions.ts",
  "../src/lib/stock-actions.ts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
assert.doesNotMatch(
  stockApplicationSources,
  /from\("stock_moves"\)\s*\.insert/,
  "Aucune insertion applicative de stock ne doit contourner l'operation atomique.",
);
assert.match(
  stockApplicationSources,
  /recordStockMovementsAtomic/,
  "Les flux article, achat, vente et ajustement doivent utiliser le point d'ecriture stock centralise.",
);

const purchaseActionsSource = readFileSync(
  new URL("../src/lib/purchase-actions.ts", import.meta.url),
  "utf8",
);
assert.match(
  purchaseActionsSource,
  /source_line_id: line\.id/,
  "Le mouvement d'une reception fournisseur doit viser la ligne de reception, pas la ligne de commande.",
);
assert.match(
  purchaseActionsSource,
  /finalizeDocumentType: "supplier_receipt"/,
  "La validation de reception et l'ecriture du stock doivent partager la meme transaction SQL.",
);

function tsxFilesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFilesBelow(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const nestedInteractiveFiles = tsxFilesBelow(sourceRoot).filter((path) => {
  const source = readFileSync(path, "utf8");
  return /<(?:Link|a)(?:\s[^>]*)?>\s*<Button/.test(source);
});
assert.deepEqual(
  nestedInteractiveFiles,
  [],
  "Un lien ne doit jamais contenir un bouton interactif imbrique ; utiliser Button asChild.",
);

const seededLines: Record<string, unknown>[] = [
  { __parent_reference: "DOC-1", document_id: "placeholder", total_ttc: 120 },
  { __parent_reference: "DOC-1", document_id: "placeholder", total_ttc: 240 },
  { __parent_reference: "DOC-2", document_id: "placeholder", total_ttc: 360 },
];
resolveSeedLineParents(
  seededLines,
  { "DOC-1": "document-1", "DOC-2": "document-2" },
  "document_id",
);
assert.deepEqual(
  seededLines.map((line) => line.document_id),
  ["document-1", "document-1", "document-2"],
  "Chaque ligne de démonstration doit rester rattachée au document qui l'a générée.",
);
assert.equal(
  seededLines.some((line) => "__parent_reference" in line),
  false,
  "La référence technique de seed ne doit jamais être envoyée à Supabase.",
);

// ESSENTIEL lasts exactly15days; legacy Business retains calendar-month clamping.
const trialDateCases: Array<{ start: string; expected: string; business?: boolean }> = [
  { start: "2026-10-31T12:34:56.000Z", expected: "2026-11-15T12:34:56.000Z" },
  { start: "2026-01-31T08:00:00.000Z", expected: "2026-02-15T08:00:00.000Z" },
  { start: "2028-01-31T08:00:00.000Z", expected: "2028-02-15T08:00:00.000Z" },
  { start: "2026-12-31T08:00:00.000Z", expected: "2027-01-15T08:00:00.000Z" },
  { start: "2026-05-15T23:59:00.000Z", expected: "2026-05-30T23:59:00.000Z" },
  { start: "2028-02-28T08:00:00.000Z", expected: "2028-03-14T08:00:00.000Z" },
  { start: "2026-11-30T08:00:00.000Z", expected: "2027-02-28T08:00:00.000Z", business: true },
];
for (const { start, expected, business } of trialDateCases) {
  const source = new Date(start);
  const end = business ? getBusinessTrialEndDate(source) : getDefaultTrialEndDate(source);
  assert.equal(end.toISOString(), expected, `L’essai du ${start} doit se terminer le ${expected}.`);
  assert.equal(source.toISOString(), start, "Le calcul d’essai ne doit pas modifier la date source.");
}

const shared = calculateCommercialAmounts({ quantity: 2.0004, unitPriceHt: 100.005, discountRate: 10, taxRate: 7 });
assert.equal(shared.quantity, 2);
assert.equal(shared.unitPriceHt, 100.01);
assert.equal(shared.grossHt, 200.02);
assert.equal(shared.discountAmount, 20);
assert.equal(shared.netHt, 180.02);
assert.equal(shared.taxAmount, 12.6);
assert.equal(shared.totalTtc, 192.62);

const invoiceLine = calculateInvoiceLine({
  id: "line",
  mode: "free",
  product_id: "",
  product_name: "",
  description: "Taux réduit",
  quantity: 2.0004,
  unit_id: "",
  unit_name: "",
  unit_price_ht: 100.005,
  discount_rate: 10,
  tax_rate_id: "",
  tax_rate: 7,
  subtotal_ht: 0,
  discount_amount: 0,
  tax_amount: 0,
  total_ttc: 0,
});
assert.equal(invoiceLine.subtotal_ht, shared.netHt, "La facture stocke le HT net.");
assert.equal(invoiceLine.total_ttc, shared.totalTtc);
const commerceLine = calculateLine({
  id: "commerce",
  mode: "free",
  product_id: "",
  product_name: "",
  description: "Même ligne",
  quantity: 2.0004,
  unit_id: "",
  unit_name: "",
  unit_price_ht: 100.005,
  discount_rate: 10,
  tax_rate_id: "",
  tax_rate: 7,
  subtotal_ht: 0,
  tax_amount: 0,
  total_ttc: 0,
});
assert.equal(commerceLine.subtotal_ht, invoiceLine.subtotal_ht, "Devis et facture utilisent le même net.");
assert.equal(commerceLine.tax_amount, invoiceLine.tax_amount);
assert.equal(commerceLine.total_ttc, invoiceLine.total_ttc);

const mixed = [20, 14, 10, 7, 0].map((rate) => calculateCommercialAmounts({ quantity: 1, unitPriceHt: 100, discountRate: 0, taxRate: rate }));
const totals = calculateInvoiceTotals(mixed.map((line) => ({
  ...invoiceLine,
  subtotal_ht: line.netHt,
  discount_amount: line.discountAmount,
  tax_amount: line.taxAmount,
  total_ttc: line.totalTtc,
  tax_rate: line.taxRate,
})));
assert.equal(totals.subtotal_ht, 500);
assert.equal(totals.tax_total, 51);
assert.equal(totals.total_ttc, 551);
const vatSummary = summarizeVatByRate(mixed.map((line) => ({ netHt: line.netHt, taxRate: line.taxRate, taxAmount: line.taxAmount })));
assert.deepEqual(vatSummary.map((row) => row.rate), [0, 7, 10, 14, 20]);
assert.equal(vatSummary.find((row) => row.rate === 7)?.vat, 7);

const declaration = buildDeclarationLines({
  salesBreakdowns: mixed.filter((line) => line.taxRate > 0).map((line) => ({ taxRate: line.taxRate, baseHtMad: line.netHt, vatAmountMad: line.taxAmount })),
  collectedVatMad: 51,
  deductibleVatMad: 0,
  vatDueMad: 51,
  creditCarryForwardMad: 0,
});
assert.equal(declaration.find((line) => line.code === "110")?.amountMad, 100, "La base à 7 % a une ligne dédiée.");
assert.equal(declaration.find((line) => line.code === "110T")?.amountMad, 7);
assert.deepEqual(vatDeclarationImbalance(declaration), { baseGap: 0, vatGap: 0 });
const withoutSeven = declaration.map((line) => line.code === "110" || line.code === "110T" ? { ...line, amountMad: 0 } : line);
assert.notEqual(vatDeclarationImbalance(withoutSeven).baseGap, 0, "Une base à 7 % non ventilée déséquilibre la déclaration.");

assert.equal(canLetterLines([
  { accountCode: "3421", debit: 120, credit: 0 },
  { accountCode: "3421", debit: 0, credit: 120 },
]), true);
assert.equal(canLetterLines([
  { accountCode: "3421", debit: 120, credit: 0 },
  { accountCode: "4411", debit: 0, credit: 120 },
]), false);
assert.equal(isBaseOnlyPayrollAcknowledgement("yes"), true);
assert.equal(isBaseOnlyPayrollAcknowledgement("no"), false);
assert.equal(PERSISTED_PAYROLL_SCOPE, "base_only_preparatory");
assert.equal(hasValidSubscriptionAccess({ status: "past_due", current_period_end: "2099-01-01" }), false, "past_due reste en lecture seule.");
assert.equal(canAccessFeature("essentiel", "stock"), false);
assert.equal(canAccessFeature("premium", "stock"), true);
assert.equal(canAccessFeature("essentiel", "invoices"), true);

const payslip = calculateMoroccanPayslip2026({ baseSalary: 6000, hireDate: "2026-01-01", periodDate: "2026-06-01", dependents: 0 });
assert.equal(payslip.cnssEmployee, 268.8);
assert.equal(payslip.amoEmployee, 135.6);
assert.equal(payslip.professionalExpense, 2100);
assert.equal(payslip.ir, 16.23);
assert.equal(payslip.net, 5579.37);
assert.equal(seniorityRate(5), 10);
assert.equal(seniorityRate(1), 0);
const cump = computeCump([
  { direction: "in", quantity: 10, unitCost: 80 },
  { direction: "in", quantity: 10, unitCost: 100 },
  { direction: "out", quantity: 5 },
]);
assert.equal(cump.quantity, 15);
assert.equal(cump.averageCost, 90);
assert.equal(cump.value, 1350);
assert.equal(computeCump([{ direction: "in", quantity: 1, unitCost: 10 }, { direction: "out", quantity: 4 }]).negativeAttempt, true);
const statements = buildFinancialStatements([
  { accountCode: "3421", debit: 120, credit: 0 },
  { accountCode: "4455", debit: 0, credit: 20 },
  { accountCode: "7111", debit: 0, credit: 100 },
]);
assert.equal(statements.produits, 100);
assert.equal(statements.resultat, 100);
assert.equal(statements.balanced, true);
assert.equal(agingBucket("2026-10-20", "2026-11-03", 50), "1_30");
assert.equal(agingBucket("2026-12-01", "2026-11-03", 50), "not_due");
assert.equal(matchPurchase([{ description: "Câble", ordered: 4, received: 4, invoiced: 4 }]).matched, true);
assert.equal(matchPurchase([{ description: "Câble", ordered: 4, received: 3, invoiced: 4 }]).matched, false);

console.log("Régressions QA vérifiées : comptabilisation des remises, prévisions, statuts documentaires, totaux, TVA 7 %, paie 2026, CMUP, états et rattachement du seed.");
