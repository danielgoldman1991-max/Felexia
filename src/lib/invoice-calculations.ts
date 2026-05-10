import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export function roundInvoice2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateInvoiceLine(line: InvoiceLineFormValue): InvoiceLineFormValue {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price_ht || 0);
  const discountRate = Number(line.discount_rate || 0);
  const taxRate = Number(line.tax_rate || 0);
  const grossHt = quantity * unitPrice;
  const discountAmount = grossHt * discountRate / 100;
  const subtotalHt = grossHt - discountAmount;
  const taxAmount = subtotalHt * taxRate / 100;

  return {
    ...line,
    quantity,
    unit_price_ht: unitPrice,
    discount_rate: discountRate,
    tax_rate: taxRate,
    discount_amount: roundInvoice2(discountAmount),
    subtotal_ht: roundInvoice2(subtotalHt),
    tax_amount: roundInvoice2(taxAmount),
    total_ttc: roundInvoice2(subtotalHt + taxAmount),
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
