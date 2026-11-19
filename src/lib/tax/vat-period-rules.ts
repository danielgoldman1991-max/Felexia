import { roundMad } from "@/lib/tax/dgi-vat-mapping";

export type VatRegimeMode = "encaissement" | "debit" | "mixed" | "unspecified";

/** Encaissement, mixte ou régime non paramétré : la déduction suit la date du règlement. */
export function deductionFollowsPayment(regime: VatRegimeMode) {
  return regime !== "debit";
}

/** Compte de la classe 2, hors amortissements (28) et provisions (29). */
export function isFixedAssetAccount(code: string | null | undefined) {
  const digits = String(code ?? "").replace(/\s/g, "");
  return /^2(?![89])\d*$/.test(digits);
}

export function isFixedAssetPurchase(input: { accountCodes?: string[]; marked?: boolean }) {
  if (input.marked) return true;
  return (input.accountCodes ?? []).some((code) => isFixedAssetAccount(code));
}

const CUSTOMER_CREDIT_TYPES = new Set(["customer_credit_note", "credit_note"]);
const SUPPLIER_CREDIT_TYPES = new Set(["supplier_credit_note"]);

export function creditNotePosted(sourceTypes: string[], side: "customer" | "supplier") {
  const accepted = side === "customer" ? CUSTOMER_CREDIT_TYPES : SUPPLIER_CREDIT_TYPES;
  return sourceTypes.some((type) => accepted.has(type));
}

export type VatRateLine = { taxRate: number; baseHt: number; vat: number; ttc: number };

/** Date calendaire au Maroc. Une date déjà AAAA-MM-JJ n'est pas réinterprétée. */
export function casablancaIsoDate(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export type VatPaymentSlice = {
  date: string;
  amount: number;
  mode?: string | null;
  reference?: string | null;
};

export type PurchaseCandidate = {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE";
  number: string;
  invoiceDate: string;
  supplierName: string | null;
  supplierIf: string | null;
  supplierIce: string | null;
  description: string | null;
  totalTtc: number;
  lines: VatRateLine[];
  payments: VatPaymentSlice[];
  accountCodes: string[];
  markedFixedAsset: boolean;
};

export type PurchaseDeduction = {
  included: boolean;
  prorata: number;
  paidInPeriod: number;
  paymentDate: string | null;
  paymentMode: string | null;
  paymentReference: string | null;
  fixedAsset: boolean;
  lines: Array<{ taxRate: number; baseHt: number; vatOnInvoice: number; deductibleVat: number; ttc: number }>;
  baseHt: number;
  vatOnInvoice: number;
  deductibleVat: number;
  ttc: number;
};

function inPeriod(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function scale(value: number, prorata: number, sign: number) {
  return roundMad(roundMad(value * prorata) * sign);
}

export function selectPurchaseDeduction(
  purchase: PurchaseCandidate,
  period: { start: string; end: string },
  regime: VatRegimeMode,
): PurchaseDeduction {
  const sign = purchase.documentType === "CREDIT_NOTE" ? -1 : 1;
  const fixedAsset = isFixedAssetPurchase({ accountCodes: purchase.accountCodes, marked: purchase.markedFixedAsset });
  const empty: PurchaseDeduction = {
    included: false,
    prorata: 0,
    paidInPeriod: 0,
    paymentDate: null,
    paymentMode: null,
    paymentReference: null,
    fixedAsset,
    lines: [],
    baseHt: 0,
    vatOnInvoice: 0,
    deductibleVat: 0,
    ttc: 0,
  };
  const grossVat = roundMad(purchase.lines.reduce((sum, line) => sum + line.vat, 0));
  const grossTtc = roundMad(purchase.totalTtc);
  if (purchase.documentType === "CREDIT_NOTE") {
    if (!inPeriod(purchase.invoiceDate, period.start, period.end) || grossVat === 0) return empty;
    return materialize(purchase, 1, sign, grossTtc, purchase.invoiceDate, null, null, fixedAsset);
  }
  if (deductionFollowsPayment(regime)) {
    const payments = purchase.payments.filter((payment) => payment.date && inPeriod(payment.date, period.start, period.end) && payment.amount > 0);
    const paid = roundMad(payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (paid <= 0 || grossTtc <= 0 || grossVat === 0) return empty;
    const prorata = Math.min(paid / grossTtc, 1);
    const latest = payments.reduce((best, payment) => payment.date > best.date ? payment : best);
    return materialize(purchase, prorata, sign, paid, latest.date, latest.mode ?? null, latest.reference ?? null, fixedAsset);
  }
  if (!inPeriod(purchase.invoiceDate, period.start, period.end) || grossVat === 0) return empty;
  return materialize(purchase, 1, sign, grossTtc, purchase.invoiceDate, null, null, fixedAsset);
}

function materialize(
  purchase: PurchaseCandidate,
  prorata: number,
  sign: number,
  paidInPeriod: number,
  paymentDate: string,
  paymentMode: string | null,
  paymentReference: string | null,
  fixedAsset: boolean,
): PurchaseDeduction {
  const lines = purchase.lines.map((line) => ({
    taxRate: line.taxRate,
    baseHt: scale(line.baseHt, prorata, sign),
    vatOnInvoice: roundMad(line.vat * sign),
    deductibleVat: scale(line.vat, prorata, sign),
    ttc: scale(line.ttc, prorata, sign),
  }));
  return {
    included: true,
    prorata,
    paidInPeriod: roundMad(paidInPeriod),
    paymentDate,
    paymentMode,
    paymentReference,
    fixedAsset,
    lines,
    baseHt: roundMad(lines.reduce((sum, line) => sum + line.baseHt, 0)),
    vatOnInvoice: roundMad(lines.reduce((sum, line) => sum + line.vatOnInvoice, 0)),
    deductibleVat: roundMad(lines.reduce((sum, line) => sum + line.deductibleVat, 0)),
    ttc: roundMad(lines.reduce((sum, line) => sum + line.ttc, 0)),
  };
}

export type SaleCandidate = {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE";
  issueDate: string;
  lines: VatRateLine[];
  postedSourceTypes: string[];
};

export function saleIncluded(sale: SaleCandidate, period: { start: string; end: string }) {
  return inPeriod(sale.issueDate, period.start, period.end);
}

export function saleVat(sale: SaleCandidate) {
  const sign = sale.documentType === "CREDIT_NOTE" ? -1 : 1;
  return roundMad(sale.lines.reduce((sum, line) => sum + line.vat, 0) * sign);
}

/**
 * Codes `mp/id` du relevé SIMPL-TVA (DGI) :
 * 1 Espèces, 2 Chèque, 3 Prélèvement, 4 Virement, 5 Effet, 6 Compensation, 7 Autre.
 * La carte n'a pas de code distinct : elle est enregistrée en 7.
 */
const SIMPL_PAYMENT_MODE_IDS: Record<string, string> = {
  cash: "1",
  especes: "1",
  espèces: "1",
  espece: "1",
  cheque: "2",
  chèque: "2",
  check: "2",
  certified_check: "2",
  prelevement: "3",
  prélèvement: "3",
  direct_debit: "3",
  bank_transfer: "4",
  transfer: "4",
  virement: "4",
  effet: "5",
  bill: "5",
  bill_of_exchange: "5",
  lcn: "5",
  traite: "5",
  lettre_de_change: "5",
  compensation: "6",
  offset: "6",
  other: "7",
  autre: "7",
  card: "7",
  carte: "7",
  bank_card: "7",
};

export function simplPaymentModeId(mode: string | null | undefined) {
  const key = String(mode ?? "").trim().toLowerCase();
  return SIMPL_PAYMENT_MODE_IDS[key] ?? "7";
}

export function simplRegimeCode(regime: VatRegimeMode) {
  return regime === "debit" ? "2" : "1";
}

export type UnallocatedSupplierPayment = {
  id: string;
  supplierId: string;
  date: string | null;
  amount: number;
  mode: string | null;
  reference: string | null;
};

export type InvoicePaymentState = {
  id: string;
  supplierId: string | null;
  allocations: VatPaymentSlice[];
  paidAmount: number;
  status: string | null;
  paymentStatus: string | null;
};

export type ResolvedInvoicePayments = {
  id: string;
  payments: VatPaymentSlice[];
  unallocated: boolean;
};

function markedPaid(state: Pick<InvoicePaymentState, "paidAmount" | "status" | "paymentStatus">) {
  if (roundMad(state.paidAmount) > 0.009) return true;
  const status = `${state.status ?? ""} ${state.paymentStatus ?? ""}`.toLowerCase();
  return status.includes("paid") || status.includes("partial");
}

/** Les imputations priment. Le reste payé n'est ajouté que s'il existe une seule date de paiement disponible. */
export function resolveUnallocatedPayments(
  invoices: InvoicePaymentState[],
  pool: UnallocatedSupplierPayment[],
): ResolvedInvoicePayments[] {
  const remaining = pool.map((payment) => ({ ...payment, left: roundMad(payment.amount) }));
  return invoices.map((invoice) => {
    const allocations = invoice.allocations.filter((payment) => payment.amount > 0.009 && payment.date);
    const allocated = roundMad(allocations.reduce((sum, payment) => sum + payment.amount, 0));
    const recorded = roundMad(Math.max(invoice.paidAmount, 0));
    if (allocated > 0.009) {
      const gap = roundMad(Math.max(recorded - allocated, 0));
      if (gap <= 0.01) return { id: invoice.id, payments: allocations, unallocated: false };
      const extra = takeSinglePayment(remaining, invoice.supplierId, gap);
      if (!extra) return { id: invoice.id, payments: allocations, unallocated: true };
      return { id: invoice.id, payments: [...allocations, extra], unallocated: false };
    }
    if (!markedPaid(invoice)) return { id: invoice.id, payments: [], unallocated: false };
    const slice = takeSinglePayment(remaining, invoice.supplierId, recorded);
    if (!slice) return { id: invoice.id, payments: [], unallocated: true };
    return { id: invoice.id, payments: [slice], unallocated: false };
  });
}

function takeSinglePayment(
  pool: Array<UnallocatedSupplierPayment & { left: number }>,
  supplierId: string | null,
  needed: number,
): VatPaymentSlice | null {
  if (!supplierId || needed <= 0.009) return null;
  const matches = pool.filter((payment) => payment.supplierId === supplierId && payment.left > 0.009 && casablancaIsoDate(payment.date));
  if (matches.length !== 1) return null;
  const payment = matches[0];
  const amount = roundMad(Math.min(needed, payment.left));
  payment.left = roundMad(payment.left - amount);
  return {
    date: casablancaIsoDate(payment.date),
    amount,
    mode: payment.mode,
    reference: payment.reference,
  };
}
