import { crc32 } from "node:zlib";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import type { DgiVatPurchaseDocument } from "@/lib/tax/dgi-vat-types";
import { casablancaIsoDate, deductionFollowsPayment, simplPaymentModeId, type VatRegimeMode } from "@/lib/tax/vat-period-rules";

export type SimplDeductionRow = {
  number: string;
  description: string;
  baseHt: number;
  vat: number;
  ttc: number;
  supplierId?: string | null;
  supplierIf: string | null;
  supplierName: string | null;
  supplierIce: string | null;
  taxRate: number;
  prorataPercent: number;
  paymentMode: string | null;
  paymentDate: string | null;
  invoiceDate: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlText(value: unknown) {
  return escapeXml(String(value ?? ""));
}

/** Espace simple, texte trimé, caractères de contrôle XML retirés. */
export function simplPlainText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\t\n\r\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

function partyText(value: unknown, fallback = "") {
  return escapeXml(simplPlainText(value) || fallback);
}

function round2(value: number) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Au plus deux décimales, sans zéro final inutile. */
export function officialAmount(value: number) {
  return round2(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/** ttc est la somme des montants déjà arrondis, donc mht + tva = ttc. */
export function balancedSimplAmounts(baseHt: number, vat: number) {
  const mht = round2(baseHt);
  const tva = round2(vat);
  return { mht, tva, ttc: round2(mht + tva) };
}

function inPeriod(date: string | null, start: string, end: string) {
  return Boolean(date) && date! >= start && date! <= end;
}

export type SimplDeductionIssue = {
  code: string;
  message: string;
  href: string | null;
};

const ACCEPTED_RATES = new Set([7, 10, 14, 20]);

function supplierHref(row: SimplDeductionRow) {
  return row.supplierId ? `/tiers/${row.supplierId}` : null;
}

function invoiceList(numbers: string[]) {
  const unique = [...new Set(numbers.filter(Boolean))];
  const shown = unique.slice(0, 8).join(", ");
  const extra = unique.length > 8 ? ` et ${unique.length - 8} autre${unique.length - 8 > 1 ? "s" : ""}` : "";
  return `${unique.length} facture${unique.length > 1 ? "s" : ""}${shown ? ` : ${shown}${extra}` : ""}`;
}

/** Bloque l'export local si le relevé ne peut pas égaler la ligne 190. Aucun envoi DGI. */
export function simplDeductionIssues(input: {
  fiscalId: string | null;
  regime: VatRegimeMode;
  periodStart: string;
  periodEnd: string;
  frequency?: SimplFilingFrequency;
  line190: number;
  rows: SimplDeductionRow[];
}) {
  const issues: SimplDeductionIssue[] = [];
  const fiscalId = input.fiscalId?.trim() ?? "";
  if (!fiscalId) {
    issues.push({ code: "COMPANY_IF", message: "L'identifiant fiscal de la société est absent.", href: "/parametres/entreprise" });
  } else if (!/^\d+$/.test(fiscalId)) {
    issues.push({ code: "COMPANY_IF", message: "L'identifiant fiscal de la société doit contenir uniquement des chiffres.", href: "/parametres/entreprise" });
  }
  const periodIssue = simplFilingIssue(input.periodStart, input.periodEnd, input.frequency ?? "monthly");
  if (periodIssue) issues.push({ code: "PERIOD", message: periodIssue, href: null });

  const groups = new Map<string, { name: string; href: string | null; invoices: string[]; kind: "if" | "ice" }>();
  input.rows.forEach((row, index) => {
    const label = row.number || `ligne ${index + 1}`;
    const name = simplPlainText(row.supplierName) || "Fournisseur sans nom";
    const ifValue = row.supplierIf?.trim() ?? "";
    const iceValue = row.supplierIce?.trim() ?? "";
    if (!/^\d+$/.test(ifValue)) {
      const key = `${row.supplierId ?? name}:if`;
      const group = groups.get(key) ?? { name, href: supplierHref(row), invoices: [], kind: "if" as const };
      group.invoices.push(label);
      groups.set(key, group);
    }
    if (!/^\d{15}$/.test(iceValue)) {
      const key = `${row.supplierId ?? name}:ice`;
      const group = groups.get(key) ?? { name, href: supplierHref(row), invoices: [], kind: "ice" as const };
      group.invoices.push(label);
      groups.set(key, group);
    }
    if (!Number.isFinite(row.taxRate)) {
      issues.push({ code: "TAX_RATE", message: `${label} : taux de TVA absent.`, href: null });
    } else if (!ACCEPTED_RATES.has(round2(row.taxRate))) {
      issues.push({ code: "TAX_RATE", message: `${label} : taux ${officialAmount(row.taxRate)} hors 7, 10, 14 et 20.`, href: null });
    }
    const deductionDate = casablancaIsoDate(deductionFollowsPayment(input.regime) ? row.paymentDate : row.invoiceDate);
    if (!inPeriod(deductionDate, input.periodStart, input.periodEnd)) {
      issues.push({
        code: "DATE",
        message: `${label} : la date de ${deductionFollowsPayment(input.regime) ? "paiement" : "facture"} n'est pas dans la période.`,
        href: null,
      });
    }
  });
  for (const group of groups.values()) {
    const count = invoiceList(group.invoices);
    issues.push(group.kind === "if"
      ? { code: "SUPPLIER_IF", message: `${group.name} : IF absent ou non numérique (${count}).`, href: group.href }
      : { code: "SUPPLIER_ICE", message: `${group.name} : ICE absent ou différent de 15 chiffres (${count}). Un fournisseur étranger sans ICE marocain est refusé.`, href: group.href });
  }
  const total = roundMad(input.rows.reduce((sum, row) => sum + row.vat, 0));
  if (Math.abs(total - roundMad(input.line190)) > 0.001) {
    issues.push({
      code: "TOTAL",
      message: `Le total du relevé (${total.toFixed(2)}) est différent de la ligne 190 (${roundMad(input.line190).toFixed(2)}).`,
      href: null,
    });
  }
  return issues;
}

export function formatSimplDeductionIssues(issues: SimplDeductionIssue[]) {
  const lines = ["Le relevé SIMPL-TVA ne peut pas être généré."];
  for (const issue of issues) {
    lines.push("");
    lines.push(issue.message);
    if (issue.href) lines.push(`Corriger : ${issue.href}`);
  }
  return lines.join("\n");
}

export type SimplFilingFrequency = "monthly" | "quarterly";

function calendarParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isExactMonth(start: { y: number; m: number; d: number }, end: { y: number; m: number; d: number }) {
  return start.d === 1 && start.y === end.y && start.m === end.m && end.d === lastDayOfMonth(start.y, start.m);
}

function isExactQuarter(start: { y: number; m: number; d: number }, end: { y: number; m: number; d: number }) {
  const quarterStart = start.m === 1 || start.m === 4 || start.m === 7 || start.m === 10;
  return quarterStart && start.d === 1 && start.y === end.y && end.m === start.m + 2 && end.d === lastDayOfMonth(start.y, end.m);
}

/** Refuse un intervalle qui n'est pas le mois ou le trimestre civil demandé. */
export function simplFilingIssue(periodStart: string, periodEnd: string, frequency: SimplFilingFrequency) {
  const start = calendarParts(periodStart);
  const end = calendarParts(periodEnd);
  if (!start || !end) return "La période du relevé n'est pas une date exploitable.";
  if (frequency === "monthly" && !isExactMonth(start, end)) {
    return `La période ${periodStart} au ${periodEnd} ne correspond pas à un mois civil. Le relevé mensuel exige du 1er au dernier jour du même mois.`;
  }
  if (frequency === "quarterly" && !isExactQuarter(start, end)) {
    return `La période ${periodStart} au ${periodEnd} ne correspond pas à un trimestre civil. Le relevé trimestriel exige janvier-mars, avril-juin, juillet-septembre ou octobre-décembre.`;
  }
  return null;
}

/** regime 1 = mois (période 1-12), regime 2 = trimestre (période 1-4). Sans fin, le mois de début est conservé. */
export function officialSimplFiling(periodStart: string, frequency: SimplFilingFrequency, periodEnd?: string) {
  if (periodEnd && simplFilingIssue(periodStart, periodEnd, frequency)) return null;
  const month = Number(periodStart.slice(5, 7));
  const quarterly = frequency === "quarterly";
  return {
    annee: periodStart.slice(0, 4),
    periode: String(quarterly ? Math.floor((month - 1) / 3) + 1 : month),
    regime: quarterly ? "2" : "1",
  };
}

export function simplPeriodNumber(periodStart: string, frequency: SimplFilingFrequency) {
  return officialSimplFiling(periodStart, frequency)?.periode ?? "";
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
        supplierId: document.supplierId,
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
  periodEnd?: string;
  frequency: SimplFilingFrequency;
  regime: VatRegimeMode;
  rows: SimplDeductionRow[];
}) {
  const filing = officialSimplFiling(input.periodStart, input.frequency, input.periodEnd);
  if (!filing) return "";
  const rows = input.rows.map((row, index) => {
    const amounts = balancedSimplAmounts(row.baseHt, row.vat);
    const paymentDate = casablancaIsoDate(deductionFollowsPayment(input.regime) ? row.paymentDate : row.invoiceDate);
    const invoiceDate = casablancaIsoDate(row.invoiceDate);
    return `<rd><ord>${index + 1}</ord><num>${xmlText(row.number)}</num><des>${partyText(row.description, "ACHAT")}</des><mht>${officialAmount(amounts.mht)}</mht><tva>${officialAmount(amounts.tva)}</tva><ttc>${officialAmount(amounts.ttc)}</ttc><refF><if>${xmlText(row.supplierIf)}</if><nom>${partyText(row.supplierName)}</nom><ice>${xmlText(row.supplierIce)}</ice></refF><tx>${officialAmount(row.taxRate)}</tx><mp><id>${simplPaymentModeId(row.paymentMode)}</id></mp><dpai>${xmlText(paymentDate)}</dpai><dfac>${xmlText(invoiceDate)}</dfac></rd>`;
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
