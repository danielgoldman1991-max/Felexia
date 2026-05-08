import type { CommerceLineFormValue } from "@/lib/commerce-types";

export type TaxRateForSelect = { id: string; name?: string; rate: number };

export type CommerceDocumentTotals = {
  subtotal_ht: number;
  tax_total: number;
  total_ttc: number;
};

export function round2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateLine(line: CommerceLineFormValue): CommerceLineFormValue {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price_ht || 0);
  const discountRate = Number(line.discount_rate || 0);
  const taxRate = Number(line.tax_rate || 0);

  const subtotalHt = quantity * unitPrice * (1 - discountRate / 100);
  const taxAmount = subtotalHt * taxRate / 100;
  const totalTtc = subtotalHt + taxAmount;

  return {
    ...line,
    quantity,
    unit_price_ht: unitPrice,
    discount_rate: discountRate,
    tax_rate: taxRate,
    subtotal_ht: round2(subtotalHt),
    tax_amount: round2(taxAmount),
    total_ttc: round2(totalTtc),
  };
}

export function calculateTotals(lines: CommerceLineFormValue[]): CommerceDocumentTotals {
  return {
    subtotal_ht: round2(lines.reduce((sum, line) => sum + Number(line.subtotal_ht || 0), 0)),
    tax_total: round2(lines.reduce((sum, line) => sum + Number(line.tax_amount || 0), 0)),
    total_ttc: round2(lines.reduce((sum, line) => sum + Number(line.total_ttc || 0), 0)),
  };
}

export function createEmptyDraftLine(defaultTaxRate?: TaxRateForSelect | null): CommerceLineFormValue {
  return {
    id: `draft-${Date.now()}`,
    mode: "free",
    product_id: "",
    product_name: "",
    description: "",
    quantity: 1,
    unit_id: "",
    unit_name: "",
    unit_price_ht: 0,
    discount_rate: 0,
    tax_rate_id: defaultTaxRate?.id ?? "",
    tax_rate: Number(defaultTaxRate?.rate ?? 0),
    subtotal_ht: 0,
    tax_amount: 0,
    total_ttc: 0,
  };
}
