"use server";

import { getSupplierOpenInvoices } from "@/lib/purchases";

export async function getSupplierOpenInvoicesAction(supplierId: string) {
  if (!supplierId) return { success: true as const, invoices: [] };
  try {
    const { requireActiveWorkspace } = await import("@/lib/auth");
    await requireActiveWorkspace({ module: "achats", level: "read" });
    return { success: true as const, invoices: await getSupplierOpenInvoices(supplierId) };
  } catch (error) {
    const digest = error && typeof error === "object" ? (error as { digest?: string }).digest : undefined;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
    return { success: false as const, invoices: [], error: error instanceof Error ? error.message : "Impossible de charger les factures du fournisseur." };
  }
}
