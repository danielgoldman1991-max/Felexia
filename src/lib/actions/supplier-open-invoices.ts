"use server";

import { getSupplierOpenInvoices } from "@/lib/purchases";

export async function getSupplierOpenInvoicesAction(supplierId: string) {
  if (!supplierId) return { success: true as const, invoices: [] };
  // The underlying query resolves the active workspace and scopes invoices to it.
  try {
    return { success: true as const, invoices: await getSupplierOpenInvoices(supplierId) };
  } catch {
    return { success: false as const, invoices: [], error: "Impossible de charger les factures du fournisseur." };
  }
}
