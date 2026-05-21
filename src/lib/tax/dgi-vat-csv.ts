import type { DgiVatExportData } from "@/lib/tax/dgi-vat-types";

const HEADERS = [
  "SECTION",
  "PERIODE_DEBUT",
  "PERIODE_FIN",
  "TYPE_PIECE",
  "NUMERO_PIECE",
  "DATE_PIECE",
  "TIERS_NOM",
  "TIERS_IF",
  "TIERS_ICE",
  "BASE_HT_MAD",
  "TAUX_TVA",
  "MONTANT_TVA_MAD",
  "TOTAL_TTC_MAD",
  "MODE_PAIEMENT",
  "REFERENCE_PAIEMENT",
  "DATE_PAIEMENT",
  "STATUT",
  "OBSERVATION",
];

function cell(value: unknown) {
  const text = String(value ?? "");
  if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function money(value: number) {
  return (Number(value) || 0).toFixed(2);
}

function row(values: unknown[]) {
  return values.map(cell).join(";");
}

export function generateDgiVatCsv(data: DgiVatExportData): string {
  const rows: string[] = [row(HEADERS)];

  rows.push(row([
    "SYNTHESE",
    data.period.startDate,
    data.period.endDate,
    "DECLARATION",
    data.batchId,
    data.generatedAt.slice(0, 10),
    data.organization.name,
    data.organization.ifNumber,
    data.organization.ice,
    money(data.summary.taxableTurnoverMad),
    "",
    money(data.summary.collectedVatMad - data.summary.deductibleVatMad),
    "",
    "",
    "",
    "",
    data.summary.blockingErrorsCount > 0 ? "A_CONTROLER" : "PRET",
    "XML préparatoire DGI TVA - non homologué officiel.",
  ]));

  for (const line of data.declarationLines) {
    rows.push(row([
      "DECLARATION_LINES",
      data.period.startDate,
      data.period.endDate,
      "LIGNE_DECLARATIVE",
      line.code,
      "",
      line.label,
      "",
      "",
      "",
      "",
      money(line.amountMad),
      "",
      "",
      "",
      "",
      "PREPARATOIRE",
      "Codification préparatoire à valider selon spécifications DGI applicables.",
    ]));
  }

  for (const document of data.salesDocuments) {
    for (const taxLine of document.taxBreakdown) {
      rows.push(row([
        "TVA_COLLECTEE",
        data.period.startDate,
        data.period.endDate,
        document.documentType,
        document.invoiceNumber,
        document.issueDate,
        document.customerName,
        document.customerIf,
        document.customerIce,
        money(taxLine.baseHtMad),
        money(taxLine.taxRate),
        money(taxLine.vatAmountMad),
        money(taxLine.totalTtcMad ?? document.totalTtcMad),
        "",
        "",
        "",
        document.accountingStatus ?? document.status ?? "",
        document.documentType === "CREDIT_NOTE" ? "Avoir client exporté en montants négatifs." : "",
      ]));
    }
  }

  for (const document of data.purchaseDocuments) {
    for (const taxLine of document.taxBreakdown) {
      rows.push(row([
        "TVA_DEDUCTIBLE",
        data.period.startDate,
        data.period.endDate,
        document.documentType,
        document.referenceNumber,
        document.issueDate,
        document.supplierName,
        document.supplierIf,
        document.supplierIce,
        money(taxLine.baseHtMad),
        money(taxLine.taxRate),
        money(taxLine.deductibleVatMad),
        money(document.totalTtcMad),
        document.paymentMode,
        document.paymentReference,
        document.paymentDate,
        document.accountingStatus ?? document.status ?? "",
        taxLine.deductibleVatMad < taxLine.vatOnInvoiceMad ? "TVA récupérable proratisée selon paiement fournisseur." : "",
      ]));
    }
  }

  for (const issue of data.validationIssues) {
    rows.push(row([
      "CONTROLES",
      data.period.startDate,
      data.period.endDate,
      issue.source ?? "",
      issue.documentNumber ?? issue.sourceId ?? issue.code,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      issue.severity,
      `${issue.code} - ${issue.message}${issue.suggestedFix ? ` Correction: ${issue.suggestedFix}` : ""}`,
    ]));
  }

  return `\uFEFF${rows.join("\r\n")}\r\n`;
}
