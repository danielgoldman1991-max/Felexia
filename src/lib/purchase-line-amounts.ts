import { calculateInvoiceLine, roundInvoice2 } from "@/lib/invoice-calculations";
import type { SupplierInvoiceLineFormValue } from "@/lib/purchase-types";

/** Purchases store gross HT separately from the rounded discount. */
export function calculateSupplierInvoiceLine(line: SupplierInvoiceLineFormValue): SupplierInvoiceLineFormValue {
  const calculated = calculateInvoiceLine(line);
  return { ...line, ...calculated, subtotal_ht: roundInvoice2(calculated.subtotal_ht + calculated.discount_amount) };
}
