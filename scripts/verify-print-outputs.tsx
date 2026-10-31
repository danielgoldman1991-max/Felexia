import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerInvoicePrintView } from "../src/components/invoices/customer-invoice-print-view";
import { SupplierInvoicePrintView } from "../src/components/purchases/supplier-invoice-print-view";
import { SalesQuotePrintView } from "../src/components/sales/sales-quote-print-view";
import { PrintPage } from "../src/components/print/PrintPage";
import { PrintHeader } from "../src/components/print/PrintHeader";
import { PrintDocumentTitle } from "../src/components/print/PrintDocumentTitle";
import { PrintOrganizationIdentity } from "../src/components/print/PrintOrganizationIdentity";
import { PrintLineTable } from "../src/components/print/PrintLineTable";
import { PrintFooter } from "../src/components/print/PrintFooter";
import type { OrganizationIdentity } from "../src/lib/company-identity";
import type { CustomerInvoiceLineRecord, CustomerInvoiceRecord } from "../src/lib/invoice-types";
import type { SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "../src/lib/purchase-types";
import type { SalesDocumentLineRecord, SalesDocumentRecord, SalesDocumentType } from "../src/lib/sales-types";

/** No database, session, environment file or user data is read by this fixture. */
const destination = resolve(process.argv[2] ?? "../backups/print-qa-20261031");
mkdirSync(destination, { recursive: true });
const timestamp = "2026-10-31T12:00:00.000Z";
const logo = `data:image/png;base64,${readFileSync(resolve("public/brand/felexiaerp-logo-horizontal.png")).toString("base64")}`;
const identity: OrganizationIdentity = {
  name: "ATELIER HORIZON - SERVICES ET ACCOMPAGNEMENT DES ENTREPRISES",
  logoUrl: logo,
  ice: "000000000000000",
  rc: "QA-00000",
  ifNumber: "QA-00000",
  patente: null,
  cnss: null,
  address: "Entreprise fictive de contrôle visuel, immeuble des Ateliers, troisième étage, bureau de démonstration 12",
  city: "Casablanca",
  country: "Maroc",
  phone: "+212 000 000 000",
  email: "facturation-et-relations-entreprises@exemple.invalid",
  website: "https://exemple.invalid/entreprise-de-demonstration",
  footerText: "Document de démonstration - aucun paiement attendu.",
  currency: "MAD",
};

function invoiceLine(index: number, stress: boolean): CustomerInvoiceLineRecord {
  const quantity = index % 3 + 1;
  const unitPrice = stress && index === 1 ? 12_345_678.9 : 100 + index * 3.25;
  const discountRate = index % 4 === 0 ? 10 : 0;
  const subtotal = Math.round(quantity * unitPrice * (1 - discountRate / 100) * 100) / 100;
  const taxRate = [0, 10, 20][index % 3];
  const tax = Math.round(subtotal * taxRate) / 100;
  const marker = `LIGNE-QA-${String(index).padStart(3, "0")}`;
  const longText = index % 13 === 0 ? ` - Accompagnement et mise en place d’un dispositif de suivi détaillé, comprenant la préparation, la revue des documents et la restitution des recommandations pour chaque établissement. Référence technique ${"REFERENCE".repeat(18)}.` : " - Prestation de conseil et accompagnement";
  return {
    id: `line-${index}`, organization_id: "synthetic-organization", invoice_id: "synthetic-invoice",
    source_line_id: null, source_document_id: null, line_order: index,
    product_id: null, product_name: null, description: `${marker}${stress ? longText : " - Prestation de démonstration"}`,
    quantity, unit_id: null, unit_name: index % 2 ? "jour" : "unité",
    unit_price_ht: unitPrice, discount_rate: discountRate, tax_rate_id: `tax-${taxRate}`, tax_rate: taxRate,
    subtotal_ht: subtotal, discount_amount: Math.round(quantity * unitPrice * discountRate) / 100,
    tax_amount: tax, total_ttc: Math.round((subtotal + tax) * 100) / 100,
    created_at: timestamp, updated_at: timestamp,
  };
}

function invoice(lines: CustomerInvoiceLineRecord[], currency: string, stress: boolean): CustomerInvoiceRecord {
  const sum = (key: "subtotal_ht" | "tax_amount" | "total_ttc" | "discount_amount") => Math.round(lines.reduce((total, line) => total + line[key], 0) * 100) / 100;
  return {
    id: "synthetic-invoice", organization_id: "synthetic-organization", invoice_number: stress ? "FAC-QA-2026-00075-EUR" : "FAC-QA-2026-00003-MAD", customer_id: "synthetic-customer",
    source_type: "manual", source_document_id: null, source_order_id: null, source_delivery_id: null,
    invoice_date: "2026-10-31", due_date: "2026-11-30", status: "validated", payment_status: "unpaid",
    payment_terms_days: 30, paid_amount: 0, credit_amount: 0, remaining_amount: sum("total_ttc"),
    subtotal_ht: sum("subtotal_ht"), discount_total: sum("discount_amount"), tax_total: sum("tax_amount"), total_ttc: sum("total_ttc"),
    currency, payment_terms: "days_30", payment_method: "bank_transfer", custom_payment_terms: null, custom_payment_method: null,
    notes: stress ? `NOTES-QA-DEBUT\nLes prestations sont détaillées par établissement et par période. Toute information complémentaire doit être rapprochée du document de référence.\nCoordination : ${"suivi-administratif-".repeat(8)}\nNOTES-QA-FIN` : "Document fictif pour contrôle de présentation. Aucune facture n’est enregistrée.",
    internal_notes: "NE-PAS-IMPRIMER-NOTE-INTERNE-QA", validated_at: timestamp, sent_at: null, cancelled_at: null,
    created_by: null, created_at: timestamp, updated_at: timestamp, archived_at: null,
    customer_name: stress ? "CLIENT DE DÉMONSTRATION - GROUPEMENT DES ENTREPRISES ET SERVICES SPÉCIALISÉS" : "CLIENT DE DÉMONSTRATION",
    customer_address: stress ? "Adresse fictive de test, bâtiment administratif et logistique, entrée B, 5e étage, bureau 502, quartier des Ateliers" : "Adresse fictive de test",
    customer_city: "Rabat", customer_phone: "+212 000 000 001", customer_email: "comptabilite@client.exemple.invalid", customer_ice: "000000000000001",
  };
}

const printCss = readFileSync(resolve("src/styles/print.css"), "utf8");
const base = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,sans-serif}p,h1,h2,h3{margin:0}a{color:inherit;text-decoration:none}img{max-width:100%}`;
function save(name: string, content: string) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${name}</title><base href="${pathToFileURL(resolve("public/")).href}/"><style>${base}\n${printCss}</style></head><body>${content}</body></html>`;
  writeFileSync(resolve(destination, `${name}.html`), html);
  return html;
}

const summary = [];
for (const [name, count, currency] of [["facture-courte-mad", 3, "MAD"], ["facture-longue-eur", 75, "EUR"]] as const) {
  const lines = Array.from({ length: count }, (_, index) => invoiceLine(index + 1, count > 3));
  const record = invoice(lines, currency, count > 3);
  const html = save(name, renderToStaticMarkup(<CustomerInvoicePrintView invoice={record} lines={lines} identity={identity} />));
  for (let index = 1; index <= count; index++) assert.equal(html.split(`LIGNE-QA-${String(index).padStart(3, "0")}`).length - 1, 1, `${name}: line ${index} must occur exactly once`);
  assert(!html.includes("NE-PAS-IMPRIMER-NOTE-INTERNE-QA"), "Internal notes must stay internal");
  assert(html.includes("print-table") && html.includes("<thead>"), "A repeating table header is required");
  if (currency === "EUR") {
    assert(!html.includes("MAD"), "A EUR document must not display MAD amounts");
    assert(html.includes("€") || html.includes("EUR"), "The document currency must be printed");
    assert(html.includes("NOTES-QA-FIN"), "Long notes must be complete");
  }
  summary.push({ name, rows: count, currency, total: record.total_ttc, html: `${name}.html` });
}

const purchaseLines: SupplierInvoiceLineRecord[] = Array.from({ length: 4 }, (_, index) => invoiceLine(index + 1, false));
const purchaseBase = invoice(purchaseLines, "EUR", false);
const purchase: SupplierInvoiceRecord = {
  id: "synthetic-purchase", organization_id: "synthetic-organization", invoice_number: "FF-QA-00004-EUR", supplier_invoice_number: "FRS-QA-00004",
  supplier_id: "synthetic-supplier", source_type: "manual", source_receipt_id: null, invoice_date: "2026-10-31", due_date: "2026-11-30",
  status: "validated", payment_status: "unpaid", subtotal_ht: purchaseBase.subtotal_ht, discount_total: purchaseBase.discount_total,
  tax_total: purchaseBase.tax_total, total_ttc: purchaseBase.total_ttc, paid_amount: 0, remaining_amount: purchaseBase.total_ttc,
  currency: "EUR", notes: "NOTES-ACHAT-QA - Copie fictive pour le suivi des achats.", internal_notes: "NE-PAS-IMPRIMER-NOTE-INTERNE-QA",
  validated_at: timestamp, created_by: null, created_at: timestamp, updated_at: timestamp, archived_at: null,
  supplier_name: "FOURNISSEUR DE DÉMONSTRATION", supplier_ice: "000000000000002", supplier_phone: "+212 000 000 002", supplier_email: "fournisseur@exemple.invalid",
};
const purchaseHtml = save("achat-eur-remise", renderToStaticMarkup(<SupplierInvoicePrintView invoice={purchase} lines={purchaseLines} identity={identity} />));
assert(purchaseHtml.includes("Remise") && purchaseHtml.includes("10 %"), "Purchase discounts must remain visible");
assert(!purchaseHtml.includes("MAD") && purchaseHtml.includes("EUR"), "Purchase currency must be the recorded currency");
assert(!purchaseHtml.includes("NE-PAS-IMPRIMER-NOTE-INTERNE-QA"), "Purchase internal notes must stay internal");
summary.push({ name: "achat-eur-remise", rows: purchaseLines.length, currency: "EUR", total: purchase.total_ttc, html: "achat-eur-remise.html" });

const salesLines: SalesDocumentLineRecord[] = Array.from({ length: 4 }, (_, index) => ({
  ...invoiceLine(index + 1, false), document_id: "synthetic-sales", tax_rate_name: null,
  ordered_quantity: 5, delivered_quantity: 2, returned_quantity: 0, remaining_quantity: 3, stock_move_id: null,
}));
for (const kind of ["quote", "order", "delivery_note", "return_note"] as SalesDocumentType[]) {
  const record: SalesDocumentRecord = {
    id: "synthetic-sales", organization_id: "synthetic-organization", document_type: kind, document_number: `DOC-QA-${kind.toUpperCase()}`,
    customer_id: "synthetic-customer", source_document_id: null, related_order_id: null, related_delivery_id: null,
    document_date: "2026-10-31", valid_until: "2026-11-30", expected_delivery_date: "2026-11-15", status: "draft",
    subtotal_ht: purchaseBase.subtotal_ht, tax_total: purchaseBase.tax_total, total_ttc: purchaseBase.total_ttc,
    notes: "Notes destinées au client.", internal_notes: "NE-PAS-IMPRIMER-NOTE-INTERNE-QA", return_reason: kind === "return_note" ? "Motif visible du retour fictif." : null,
    return_status: null, payment_terms: "days_30", payment_method: "bank_transfer", payment_terms_days: 30, custom_payment_terms: null, custom_payment_method: null,
    stock_updated_at: null, validated_at: null, delivered_at: null, returned_at: null, created_by: null, created_at: timestamp, updated_at: timestamp, archived_at: null,
    customer_name: "CLIENT DE DÉMONSTRATION", customer_address: "ADRESSE-QA-VISIBLE-AVEC-VILLE", customer_city: "Rabat", customer_ice: "000000000000001",
  };
  const html = save(`vente-${kind}`, renderToStaticMarkup(<SalesQuotePrintView document={record} lines={salesLines} identity={{ ...identity, currency: "EUR" }} title={{ quote: "DEVIS", order: "COMMANDE CLIENT", delivery_note: "BON DE LIVRAISON", return_note: "BON DE RETOUR" }[kind]} showSignature />));
  assert(html.includes("ADRESSE-QA-VISIBLE-AVEC-VILLE"), "A city must not suppress the street address");
  assert(!html.includes("NE-PAS-IMPRIMER-NOTE-INTERNE-QA"), "Sales internal notes must stay internal");
  if (kind === "quote" || kind === "order") assert(html.includes("Remise") && html.includes("EUR") && !html.includes("MAD"), "Commercial amounts must preserve discounts and currency");
  if (kind === "delivery_note" || kind === "return_note") assert(!html.includes("Total TTC"), "Logistics documents must preserve their existing non-monetary layout");
  summary.push({ name: `vente-${kind}`, rows: salesLines.length, currency: "EUR", total: 0, html: `vente-${kind}.html` });
}

const journalRows = Array.from({ length: 120 }, (_, index) => ({ number: `ECR-QA-${String(index + 1).padStart(3, "0")}`, amount: ((index + 1) * 125.5).toFixed(2) }));
save("journal-long-paysage", renderToStaticMarkup(
  <PrintPage orientation="landscape">
    <PrintHeader><PrintOrganizationIdentity identity={identity} infoLines={[identity.address!, "Casablanca, Maroc"]} contact="comptabilite@exemple.invalid" /><PrintDocumentTitle title="JOURNAL DES VENTES" documentNumber="VE - OCTOBRE 2026"><p><strong>Période :</strong> du 01/10/2026 au 31/10/2026</p></PrintDocumentTitle></PrintHeader>
    <PrintLineTable variant="report" head={<><th>Date</th><th>N° écriture</th><th>Source</th><th>Libellé</th><th className="right">Débit</th><th className="right">Crédit</th><th>Statut</th></>}>
      {journalRows.map((row, index) => <tr key={row.number}><td>31/10/2026</td><td>{row.number}</td><td>Facture FAC-QA-{String(index + 1).padStart(3, "0")}</td><td>Écriture fictive pour contrôle de pagination et répétition des en-têtes.</td><td className="num">{row.amount} MAD</td><td className="num">{row.amount} MAD</td><td>Comptabilisée</td></tr>)}
    </PrintLineTable>
    <PrintFooter footerText="FIN-JOURNAL-QA - Document fictif de contrôle." name={identity.name} />
  </PrintPage>
));
summary.push({ name: "journal-long-paysage", rows: journalRows.length, currency: "MAD", total: 0, html: "journal-long-paysage.html" });
writeFileSync(resolve(destination, "manifest.json"), JSON.stringify({ syntheticOnly: true, destination, fixtures: summary }, null, 2));
console.log(JSON.stringify({ syntheticOnly: true, fixtures: summary.length, directory: destination, checks: "line completeness, privacy, currency and table structure passed" }));
