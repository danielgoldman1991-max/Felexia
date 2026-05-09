import type { SalesLineFormValue, TaxRateForSalesSelect } from "@/lib/sales-types";

type UnitLike = {
  id: string;
  name?: string | null;
  symbol?: string | null;
};

export function round2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateSalesLine(line: SalesLineFormValue): SalesLineFormValue {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price_ht || 0);
  const discountRate = Number(line.discount_rate || 0);
  const taxRate = Number(line.tax_rate || 0);
  const subtotalHt = quantity * unitPrice * (1 - discountRate / 100);
  const taxAmount = subtotalHt * taxRate / 100;

  return {
    ...line,
    quantity,
    unit_price_ht: unitPrice,
    discount_rate: discountRate,
    tax_rate: taxRate,
    subtotal_ht: round2(subtotalHt),
    tax_amount: round2(taxAmount),
    total_ttc: round2(subtotalHt + taxAmount),
  };
}

export function calculateSalesTotals(lines: SalesLineFormValue[]) {
  return {
    subtotal_ht: round2(lines.reduce((sum, line) => sum + Number(line.subtotal_ht || 0), 0)),
    tax_total: round2(lines.reduce((sum, line) => sum + Number(line.tax_amount || 0), 0)),
    total_ttc: round2(lines.reduce((sum, line) => sum + Number(line.total_ttc || 0), 0)),
  };
}

export function isIndivisibleUnit(line: { unit_id?: string | null; unit_name?: string | null }, units: UnitLike[] = []) {
  const unit = line.unit_id ? units.find((item) => item.id === line.unit_id) : null;
  const symbol = line.unit_name || unit?.symbol || unit?.name || "";

  return symbol.trim().toUpperCase() === "U";
}

export function normalizeIndivisibleQuantity(quantity: number) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;

  return Math.floor(parsed);
}

export function createEmptySalesLine(defaultTaxRate?: TaxRateForSalesSelect | null): SalesLineFormValue {
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
    tax_rate_id: defaultTaxRate?.id ?? "",
    tax_rate: Number(defaultTaxRate?.rate ?? 0),
    subtotal_ht: 0,
    tax_amount: 0,
    total_ttc: 0,
  };
}
