import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeWithholding } from "../src/lib/purchases/withholding";
import { rankSupplierQuotes } from "../src/lib/purchases/rfq";
import { summarizeAging } from "../src/lib/sales/aged-receivables";
import { isLaunchPathAvailable } from "../src/lib/launch-profile";
import { isOperatorPathAllowed } from "../src/lib/auth/operator-access";

const vat = computeWithholding({ kind: "vat_attestation", vatAmount: 200 });
assert.equal(vat.withheld, 150, "Sans attestation, la retenue est 75 % de la TVA.");
assert.equal(computeWithholding({ kind: "fees_10", amountHt: 1000 }).withheld, 100);
assert.equal(computeWithholding({ kind: "fees_30", amountHt: 1000 }).withheld, 300);
assert.equal(computeWithholding({ kind: "none", vatAmount: 200 }).withheld, 0);
assert.equal(computeWithholding({ kind: "vat_attestation", vatAmount: -40 }).withheld, 0);

const ranked = rankSupplierQuotes([
  { id: "b", supplier: "Beta", totalHt: 90, totalTtc: 108, leadDays: 5 },
  { id: "a", supplier: "Alpha", totalHt: 100, totalTtc: 100, leadDays: 20 },
  { id: "c", supplier: "Gamma", totalHt: 80, totalTtc: 100, leadDays: 4 },
]);
assert.deepEqual(ranked.map((quote) => quote.supplier), ["Gamma", "Alpha", "Beta"]);
assert.equal(ranked[0].recommended, true);
assert.equal(ranked[0].rank, 1);

const aging = summarizeAging([
  { id: "1", number: "FF-1", customer: "Fournisseur", dueDate: "2026-09-01", remaining: 120 },
  { id: "2", number: "FF-2", customer: "Fournisseur", dueDate: "2026-11-20", remaining: 0 },
], "2026-11-03");
assert.equal(aging.rows.length, 1);
assert.equal(aging.totals["61_90"], 120);

assert.equal(isLaunchPathAvailable("/achats/demandes"), false);
assert.equal(isLaunchPathAvailable("/achats/demandes", true), true);
assert.equal(isOperatorPathAllowed("/achats/commandes/new", "POST"), true);
assert.equal(isOperatorPathAllowed("/articles/new"), false);
assert.equal(isOperatorPathAllowed("/rh"), false);

const paymentForm = readFileSync(new URL("../src/components/purchases/supplier-payment-form.tsx", import.meta.url), "utf8");
const customerForm = readFileSync(new URL("../src/components/payments/customer-payment-form.tsx", import.meta.url), "utf8");
assert.equal(paymentForm.includes("if (!fullAccess) setAllocations"), false, "Le règlement fournisseur partiel doit réaligner l'affectation même en PRO.");
assert.equal(customerForm.includes("if (!fullAccess) setAllocations"), false, "Le règlement client partiel doit réaligner l'affectation même en PRO.");
assert.match(paymentForm, /name="treasury_account_id"/);
assert.match(readFileSync(new URL("../src/components/purchases/supplier-invoice-form.tsx", import.meta.url), "utf8"), /type="submit" disabled=\{pending\}/);
assert.match(readFileSync(new URL("../src/app/facturation/relances/new/page.tsx", import.meta.url), "utf8"), /key=\{`\$\{customerId\}/);

console.log("Achats : retenue, comparaison d'offres, balance âgée, parcours essentiel et boutons de validation vérifiés.");
