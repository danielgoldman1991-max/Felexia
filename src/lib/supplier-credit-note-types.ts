import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export type SupplierCreditNoteStatus = "draft" | "validated" | "partially_applied" | "applied" | "cancelled";
export const SUPPLIER_CREDIT_NOTE_STATUS_LABELS: Record<SupplierCreditNoteStatus, string> = {
  draft: "Brouillon", validated: "Validé", partially_applied: "Partiellement affecté", applied: "Affecté", cancelled: "Annulé",
};
export type SupplierCreditNoteRecord = {
  id: string; organization_id: string; credit_note_number: string; supplier_credit_note_number: string;
  supplier_id: string; supplier_name: string | null; source_invoice_id: string | null; source_invoice_number: string | null;
  credit_note_date: string; status: SupplierCreditNoteStatus; subtotal_ht: number; discount_total: number;
  tax_total: number; total_ttc: number; applied_amount: number; available_amount: number; currency: string;
  reason: string | null; notes: string | null; internal_notes: string | null; created_at: string;
  validated_at: string | null; cancelled_at: string | null; archived_at: string | null;
};
export type SupplierCreditNoteLineRecord = InvoiceLineFormValue & {
  organization_id: string; credit_note_id: string; source_invoice_line_id: string | null;
};
export type SupplierCreditNoteApplicationRecord = {
  id: string; invoice_id: string; invoice_number: string | null; application_date: string;
  amount: number; cancelled_at: string | null;
};
export type SupplierCreditNoteOpenInvoice = {
  id: string; invoice_number: string; supplier_invoice_number: string | null; invoice_date: string;
  remaining_amount: number; total_ttc: number;
};
export type SupplierCreditNoteActionResult = {
  success: boolean; error?: string; data?: { entry_id?: string; entry_number?: string };
};
