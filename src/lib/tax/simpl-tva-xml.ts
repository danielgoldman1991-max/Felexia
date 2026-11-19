import { crc32 } from "node:zlib";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import type { DgiVatPurchaseDocument } from "@/lib/tax/dgi-vat-types";
import { deductionFollowsPayment, simplPaymentModeId, simplRegimeCode, type VatRegimeMode } from "@/lib/tax/vat-period-rules";

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

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return roundMad(value).toFixed(2);
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

export function simplPeriodNumber(periodStart: string, frequency: "monthly" | "quarterly") {
  const month = Number(periodStart.slice(5, 7));
  if (frequency === "quarterly") return String(Math.floor((month - 1) / 3) + 1);
  return String(month);
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

/** XML EDI du relevé. `tva` est déjà le montant déductible proratisé : la somme des `tva` est la ligne 190. */
export function buildSimplDeductionXml(input: {
  fiscalId: string;
  periodStart: string;
  frequency: "monthly" | "quarterly";
  regime: VatRegimeMode;
  rows: SimplDeductionRow[];
}) {
  const rows = input.rows.map((row, index) => `    <rd>
      <ord>${index + 1}</ord>
      <num>${xml(row.number)}</num>
      <des>${xml(row.description)}</des>
      <mht>${money(row.baseHt)}</mht>
      <tva>${money(row.vat)}</tva>
      <ttc>${money(row.ttc)}</ttc>
      <refF>
        <if>${xml(row.supplierIf)}</if>
        <nom>${xml(row.supplierName)}</nom>
        <ice>${xml(row.supplierIce)}</ice>
      </refF>
      <tx>${money(row.taxRate)}</tx>
      <prorata>${money(row.prorataPercent)}</prorata>
      <mp>
        <id>${simplPaymentModeId(row.paymentMode)}</id>
      </mp>
      <dpai>${xml(deductionFollowsPayment(input.regime) ? row.paymentDate : row.invoiceDate)}</dpai>
      <dfac>${xml(row.invoiceDate)}</dfac>
    </rd>`).join("\n");
  return `<DeclarationReleveDeduction>
  <identifiantFiscal>${xml(input.fiscalId)}</identifiantFiscal>
  <annee>${xml(input.periodStart.slice(0, 4))}</annee>
  <periode>${xml(simplPeriodNumber(input.periodStart, input.frequency))}</periode>
  <regime>${simplRegimeCode(input.regime)}</regime>
  <releveDeductions>
${rows}
  </releveDeductions>
</DeclarationReleveDeduction>
`;
}

export function simplDeductionZip(xmlBody: string) {
  const content = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xmlBody, "utf8")]);
  return zipStored("DeclarationReleveDeduction.xml", content);
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
