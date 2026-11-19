import { crc32 } from "node:zlib";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import type { DgiVatPurchaseDocument } from "@/lib/tax/dgi-vat-types";
import { deductionFollowsPayment, simplPaymentModeId, type VatRegimeMode } from "@/lib/tax/vat-period-rules";

export type SimplDeductionRow = {
  number: string;
  description: string;
  baseHt: number;
  vat: number;
  ttc: number;
  supplierIf: string | null;
  supplierName: string | null;
  supplierIce: string | null;
  taxRate: number;
  prorataPercent: number;
  paymentMode: string | null;
  paymentDate: string | null;
  invoiceDate: string;
};

function xmlText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Au plus deux décimales, sans zéro final inutile. */
export function officialAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function inPeriod(date: string | null, start: string, end: string) {
  return Boolean(date) && date! >= start && date! <= end;
}

/** Bloque l'export local si le relevé ne peut pas égaler la ligne 190. Aucun envoi DGI. */
export function simplDeductionIssues(input: {
  fiscalId: string | null;
  regime: VatRegimeMode;
  periodStart: string;
  periodEnd: string;
  line190: number;
  rows: SimplDeductionRow[];
}) {
  const issues: string[] = [];
  if (!input.fiscalId?.trim()) issues.push("L'identifiant fiscal de l'entreprise est absent.");
  input.rows.forEach((row, index) => {
    const label = row.number || `ligne ${index + 1}`;
    if (!row.supplierIf?.trim()) issues.push(`${label} : IF fournisseur absent.`);
    if (!row.supplierIce?.trim()) issues.push(`${label} : ICE fournisseur absent.`);
    const deductionDate = deductionFollowsPayment(input.regime) ? row.paymentDate : row.invoiceDate;
    if (!inPeriod(deductionDate, input.periodStart, input.periodEnd)) {
      issues.push(`${label} : la date de ${deductionFollowsPayment(input.regime) ? "paiement" : "facture"} n'est pas dans la période.`);
    }
  });
  const total = roundMad(input.rows.reduce((sum, row) => sum + row.vat, 0));
  if (Math.abs(total - roundMad(input.line190)) > 0.001) {
    issues.push(`Le total du relevé (${total.toFixed(2)}) est différent de la ligne 190 (${roundMad(input.line190).toFixed(2)}).`);
  }
  return issues;
}

export type SimplFilingFrequency = "monthly" | "quarterly";

/** regime 1 = mois (période 1-12), regime 2 = trimestre (période 1-4). */
export function officialSimplFiling(periodStart: string, frequency: SimplFilingFrequency) {
  const month = Number(periodStart.slice(5, 7));
  const quarterly = frequency === "quarterly";
  return {
    annee: periodStart.slice(0, 4),
    periode: String(quarterly ? Math.floor((month - 1) / 3) + 1 : month),
    regime: quarterly ? "2" : "1",
  };
}

export function simplPeriodNumber(periodStart: string, frequency: SimplFilingFrequency) {
  return officialSimplFiling(periodStart, frequency).periode;
}

export function simplRowsFromPurchases(documents: DgiVatPurchaseDocument[]): SimplDeductionRow[] {
  return documents.flatMap((document) => {
    const base = Math.abs(document.totalTtcMad);
    const prorataPercent = document.documentType === "CREDIT_NOTE" || base <= 0
      ? 100
      : roundMad(Math.min(document.paidAmountMad / base, 1) * 100);
    return document.taxBreakdown
      .filter((line) => line.deductibleVatMad !== 0)
      .map((line) => ({
        number: document.referenceNumber,
        description: document.description || (document.immobilizationFlag ? "Immobilisation" : "Charge"),
        baseHt: line.baseHtMad,
        vat: line.deductibleVatMad,
        ttc: roundMad(line.baseHtMad + line.deductibleVatMad),
        supplierIf: document.supplierIf,
        supplierName: document.supplierName,
        supplierIce: document.supplierIce,
        taxRate: line.taxRate,
        prorataPercent,
        paymentMode: document.paymentMode,
        paymentDate: document.paymentDate,
        invoiceDate: document.issueDate,
      }));
  });
}

/** XML EDI strictement sur une ligne, avec déclaration, sans BOM ni balise prorata. */
export function buildSimplDeductionXml(input: {
  fiscalId: string;
  periodStart: string;
  frequency: SimplFilingFrequency;
  regime: VatRegimeMode;
  rows: SimplDeductionRow[];
}) {
  const filing = officialSimplFiling(input.periodStart, input.frequency);
  const rows = input.rows.map((row, index) => {
    const paymentDate = deductionFollowsPayment(input.regime) ? row.paymentDate : row.invoiceDate;
    return `<rd><ord>${index + 1}</ord><num>${xmlText(row.number)}</num><des>${xmlText(row.description)}</des><mht>${officialAmount(row.baseHt)}</mht><tva>${officialAmount(row.vat)}</tva><ttc>${officialAmount(row.ttc)}</ttc><refF><if>${xmlText(row.supplierIf)}</if><nom>${xmlText(row.supplierName)}</nom><ice>${xmlText(row.supplierIce)}</ice></refF><tx>${officialAmount(row.taxRate)}</tx><mp><id>${simplPaymentModeId(row.paymentMode)}</id></mp><dpai>${xmlText(paymentDate)}</dpai><dfac>${xmlText(row.invoiceDate)}</dfac></rd>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>${xmlText(input.fiscalId)}</identifiantFiscal><annee>${filing.annee}</annee><periode>${filing.periode}</periode><regime>${filing.regime}</regime><releveDeductions>${rows}</releveDeductions></DeclarationReleveDeduction>`;
}

export function simplDeductionZip(xmlBody: string) {
  return zipStored("DeclarationReleveDeduction.xml", Buffer.from(xmlBody, "utf8"));
}

function zipStored(name: string, content: Buffer) {
  const crc = crc32(content) >>> 0;
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nameBuf.length, 12);
  end.writeUInt32LE(30 + nameBuf.length + content.length, 16);
  return Buffer.concat([local, nameBuf, content, central, nameBuf, end]);
}
