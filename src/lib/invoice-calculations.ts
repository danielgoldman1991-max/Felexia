import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export const NEGATIVE_QUANTITY_MESSAGE = "La quantité ne peut pas être négative.";

export function quantityDraftError(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("-") || trimmed.startsWith("−")) return NEGATIVE_QUANTITY_MESSAGE;
  const parsed = Number(trimmed.replace(",", "."));
  if (trimmed !== "" && Number.isFinite(parsed) && parsed < 0) return NEGATIVE_QUANTITY_MESSAGE;
  return null;
}

export function roundInvoice2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Shared commercial line math: quantity to 3 decimals, money to 2, discount on rounded gross HT. */
export type CommercialAmounts = {
  quantity: number;
  unitPriceHt: number;
  discountRate: number;
  taxRate: number;
  grossHt: number;
  discountAmount: number;
  netHt: number;
  taxAmount: number;
  totalTtc: number;
};

export function calculateCommercialAmounts(input: {
  quantity?: number;
  unitPriceHt?: number;
  discountRate?: number;
  taxRate?: number;
}): CommercialAmounts {
  const quantity = Math.round((Number(input.quantity || 0) + Number.EPSILON) * 1000) / 1000;
  const unitPriceHt = roundInvoice2(Number(input.unitPriceHt || 0));
  const discountRate = roundInvoice2(Number(input.discountRate || 0));
  const taxRate = roundInvoice2(Number(input.taxRate || 0));
  const grossHt = roundInvoice2(quantity * unitPriceHt);
  const discountAmount = roundInvoice2(grossHt * discountRate / 100);
  const netHt = roundInvoice2(grossHt - discountAmount);
  const taxAmount = roundInvoice2(netHt * taxRate / 100);
  const totalTtc = roundInvoice2(netHt + taxAmount);
  return { quantity, unitPriceHt, discountRate, taxRate, grossHt, discountAmount, netHt, taxAmount, totalTtc };
}

export function summarizeVatByRate(lines: Array<{ netHt: number; taxRate: number; taxAmount: number }>) {
  const totals = new Map<number, { baseHt: number; vat: number }>();
  for (const line of lines) {
    const rate = roundInvoice2(line.taxRate);
    const current = totals.get(rate) ?? { baseHt: 0, vat: 0 };
    current.baseHt = roundInvoice2(current.baseHt + line.netHt);
    current.vat = roundInvoice2(current.vat + line.taxAmount);
    totals.set(rate, current);
  }
  return [...totals.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([rate, amounts]) => ({ rate, baseHt: amounts.baseHt, vat: amounts.vat }));
}

export function calculateInvoiceLine(line: InvoiceLineFormValue): InvoiceLineFormValue {
  const amounts = calculateCommercialAmounts({
    quantity: line.quantity,
    unitPriceHt: line.unit_price_ht,
    discountRate: line.discount_rate,
    taxRate: line.tax_rate,
  });

  return {
    ...line,
    quantity: amounts.quantity,
    unit_price_ht: amounts.unitPriceHt,
    discount_rate: amounts.discountRate,
    tax_rate: amounts.taxRate,
    discount_amount: amounts.discountAmount,
    subtotal_ht: amounts.netHt,
    tax_amount: amounts.taxAmount,
    total_ttc: amounts.totalTtc,
  };
}

export function calculateInvoiceTotals(lines: InvoiceLineFormValue[]) {
  return {
    subtotal_ht: roundInvoice2(lines.reduce((sum, line) => sum + Number(line.subtotal_ht || 0), 0)),
    discount_total: roundInvoice2(lines.reduce((sum, line) => sum + Number(line.discount_amount || 0), 0)),
    tax_total: roundInvoice2(lines.reduce((sum, line) => sum + Number(line.tax_amount || 0), 0)),
    total_ttc: roundInvoice2(lines.reduce((sum, line) => sum + Number(line.total_ttc || 0), 0)),
  };
}

export function createEmptyInvoiceLine(): InvoiceLineFormValue {
  return {
    id: `draft-${Date.now()}`,
    mode: "product",
    product_id: "",
    product_name: "",
    description: "",
    quantity: 1,
    unit_id: "",
    unit_name: "",
    unit_price_ht: 0,
    discount_rate: 0,
    tax_rate_id: "",
    tax_rate: 0,
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
  };
}
