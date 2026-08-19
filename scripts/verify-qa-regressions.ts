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
import { resolveSeedLineParents } from "./lib/seed-line-parents";

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

console.log("Régressions QA vérifiées : comptabilisation des remises, prévisions, statuts documentaires et rattachement du seed.");
