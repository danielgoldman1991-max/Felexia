import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateExactLine } from "../../../src/lib/e-invoicing/calculations";
import { decimalScaled, decimalText } from "../../../src/lib/e-invoicing/decimal";
import { generateEInvoicePdf } from "../../../src/lib/e-invoicing/pdf";
import { canonicalSnapshotJson, prepareEInvoice } from "../../../src/lib/e-invoicing/ubl";
import type { EInvoiceLineInput, EInvoicePreparationOptions, EInvoiceSnapshotInput } from "../../../src/lib/e-invoicing/types";

const output = resolve("output/pdf");
const proof = resolve("training/e-invoicing/20261031/pdf-qa");
const sentinel = "INTERNAL-NOTE-MUST-NOT-APPEAR-PDF-XML";

function document(lines: EInvoiceLineInput[], number = "FAC-DEMO-0001"): EInvoiceSnapshotInput {
  const amounts = lines.map(calculateExactLine);
  const sum = (key: "subtotalHt" | "discountAmount" | "taxAmount" | "totalTtc") => decimalText(amounts.reduce((total, line) => total + decimalScaled(line[key], 2), BigInt("0")), 2);
  return {
    organizationId: "10000000-0000-4000-8000-000000000101", sourceId: "20000000-0000-4000-8000-000000000101", sourceType: "customer_invoice", number, issueDate: "2026-10-31", dueDate: "2026-11-30", currency: "MAD",
    seller: { name: "Atelier Démonstration - مقاولة تجريبية", address: "1 rue fictive de la Recette", city: "Casablanca", postalCode: "20000", countryCode: "MA", ice: "000000000000000", ifNumber: "QA-IF-0000", rc: "QA-RC-0000" },
    buyer: { name: "Client de test - عميل تجريبي", address: "10 avenue fictive des Essais", city: "Rabat", countryCode: "MA", ice: "000000000000001" },
    lines: lines.map((line, index) => ({ ...line, sourceAmounts: { subtotalHt: amounts[index].subtotalHt, discountAmount: amounts[index].discountAmount, taxAmount: amounts[index].taxAmount, totalTtc: amounts[index].totalTtc } })),
    sourceTotals: { subtotalHt: sum("subtotalHt"), discountTotal: sum("discountAmount"), taxTotal: sum("taxAmount"), totalTtc: sum("totalTtc") },
    paymentTerms: "Règlement à 30 jours - الأداء خلال ثلاثين يوماً",
    notes: "DOCUMENT FICTIF DE TEST - AUCUN PAIEMENT ATTENDU.\nوثيقة تجريبية لا تمثل فاتورة حقيقية.",
  };
}

const shortLines: EInvoiceLineInput[] = [
  { id: "short-1", description: "QA-SHORT-01 | Conseil & accompagnement - خدمة استشارية", quantity: "2.000", unitPriceHt: "100.00", discountRate: "10.00", taxRate: "20.00" },
  { id: "short-2", description: "QA-SHORT-02 | Prestation de démonstration - خدمة تجريبية", quantity: "1.000", unitPriceHt: "50.00", discountRate: "0.00", taxRate: "10.00" },
  { id: "short-3", description: "QA-SHORT-03 | Traitement à taux nul de démonstration", quantity: "1.000", unitPriceHt: "25.00", discountRate: "0.00", taxRate: "0.00" },
];
function options(lines: EInvoiceLineInput[]): EInvoicePreparationOptions {
  return { buyerType: "business", requireSellerRc: true, lineMetadata: Object.fromEntries(lines.map((line) => [line.id, { unitCode: "C62", taxCategory: line.taxRate === "0.00" ? "E" : "S", ...(line.taxRate === "0.00" ? { exemptionReason: "Motif explicite de test, sans qualification réglementaire" } : {}) }])) };
}

async function main() {
  const previousFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => { networkAttempts++; throw new Error("PDF_QA_NETWORK_FORBIDDEN"); };
  try {
    mkdirSync(output, { recursive: true }); mkdirSync(proof, { recursive: true });
    const input = { ...document(shortLines), internal_notes: sentinel };
    const short = await prepareEInvoice(input, options(input.lines));
    assert.equal(short.snapshot.totals.totalTtc, "296.00");
    await assert.rejects(generateEInvoicePdf({ ...short.snapshot, seller: { ...short.snapshot.seller, name: "Coordonnée trop longue ".repeat(700) } }, { snapshotSha256: short.snapshotSha256 }), /EINVOICE_PDF_IDENTITY_TOO_LONG/);
    await assert.rejects(generateEInvoicePdf({ ...short.snapshot, lines: [{ ...short.snapshot.lines[0], description: "Désignation trop longue ".repeat(700) }] }, { snapshotSha256: short.snapshotSha256 }), /EINVOICE_PDF_LINE_TOO_LONG/);
    const creditInput = { ...input, sourceId: "20000000-0000-4000-8000-000000000102", sourceType: "customer_credit_note" as const, number: "AV-DEMO-0001", originalInvoiceReference: input.number, reason: "Correction fictive - sans émission ni transmission officielle" };
    const credit = await prepareEInvoice(creditInput, options(creditInput.lines));
    const longLines = Array.from({ length: 68 }, (_, index): EInvoiceLineInput => ({ id: `long-${index + 1}`, description: `QA-ROW-${String(index + 1).padStart(3, "0")} | Accompagnement méthodologique détaillé : revue des documents, contrôle des pièces et restitution des recommandations pour chaque établissement. Référence de test ${"REFERENCE-".repeat(index % 3 === 0 ? 8 : 2)}.`, quantity: index % 2 ? "1.500" : "2.000", unitPriceHt: "123.45", discountRate: index % 4 ? "0.00" : "12.50", taxRate: index % 5 ? "20.00" : "0.00" }));
    const longInput = document(longLines, "FAC-DEMO-0068");
    longInput.notes = "DOCUMENT FICTIF DE TEST - AUCUN PAIEMENT ATTENDU.\n" + Array.from({ length: 15 }, (_, index) => `QA-NOTE-${String(index + 1).padStart(3, "0")} | Note publique de démonstration : ${"Les montants sont ceux de l’instantané structuré conservé avec le fichier XML. ".repeat(5)}`).join("\n") + "\nQA-NOTES-FIN";
    const longWithInternalNote = { ...longInput, internal_notes: sentinel };
    const long = await prepareEInvoice(longWithInternalNote, options(longInput.lines));
    const documents = [
      { name: "einvoice-fr", language: "fr" as const, artifact: short, rows: 3 },
      { name: "einvoice-ar", language: "ar" as const, artifact: short, rows: 3 },
      { name: "credit-note-fr", language: "fr" as const, artifact: credit, rows: 3 },
      { name: "einvoice-multipage", language: "fr" as const, artifact: long, rows: 68 },
    ];
    const results = [];
    for (const item of documents) {
      const before = canonicalSnapshotJson(item.artifact.snapshot);
      assert(!before.includes(sentinel)); assert(!item.artifact.xml.includes(sentinel));
      const bytes = await generateEInvoicePdf(item.artifact.snapshot, { language: item.language, snapshotSha256: item.artifact.snapshotSha256 });
      assert(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
      assert.equal(canonicalSnapshotJson(item.artifact.snapshot), before, "PDF generation must not mutate its XML snapshot");
      assert.equal(createHash("sha256").update(before).digest("hex"), item.artifact.snapshotSha256);
      writeFileSync(resolve(output, `${item.name}.pdf`), bytes);
      writeFileSync(resolve(proof, `${item.name}.xml`), item.artifact.xml, "utf8");
      results.push({ name: item.name, file: `output/pdf/${item.name}.pdf`, language: item.language, rows: item.rows, bytes: bytes.length, pdfSha256: createHash("sha256").update(bytes).digest("hex"), snapshotSha256: item.artifact.snapshotSha256, xmlSha256: item.artifact.xmlSha256, totals: item.artifact.snapshot.totals, taxSubtotals: item.artifact.snapshot.taxSubtotals, xsdValid: item.artifact.validation.valid, signed: item.artifact.signed, officialConformityClaim: item.artifact.officialConformityClaim });
    }
    assert.equal(results[0].snapshotSha256, results[1].snapshotSha256, "French and Arabic PDF must use the exact same snapshot");
    assert.equal(networkAttempts, 0);
    const reviewPath = resolve(proof, "visual-review.json");
    let reviewedIdenticalBytes = false;
    if (existsSync(reviewPath)) {
      const prior = JSON.parse(readFileSync(reviewPath, "utf8")) as { success: boolean; documents: { name: string; pdfSha256: string }[] };
      reviewedIdenticalBytes = prior.success && results.every(item => prior.documents.some(old => old.name === item.name && old.pdfSha256 === item.pdfSha256));
    }
    const report = { date: new Date().toISOString(), success: true, scope: "Four actual PDFKit PDFs and real UBL/XSD from synthetic snapshots; no database, DGI or network", networkAttempts, layoutOverflowRejections: 2, internalNoteSentinel: sentinel, documents: results, visualReview: reviewedIdenticalBytes ? "Byte-identical to all four PDFs already inspected in visual-review.json; prior visual inspection remains applicable." : "Pending Poppler rendering and inspection; generation/extraction alone is not visual validation" };
    writeFileSync(resolve(proof, "generation.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ success: true, outputs: results.map(item => item.file), networkAttempts }));
  } finally { globalThis.fetch = previousFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
