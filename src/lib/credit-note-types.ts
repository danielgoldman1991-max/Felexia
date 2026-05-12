import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export type CustomerCreditNoteStatus = "draft" | "validated" | "applied" | "partially_applied" | "cancelled";
export type CustomerCreditNoteSourceType = "manual" | "invoice_total" | "invoice_partial" | "return" | "commercial_gesture" | "correction";

export type CustomerCreditNoteRecord = {
  id: string;
  organization_id: string;
  credit_note_number: string;
  customer_id: string;
  customer_name?: string | null;
  source_invoice_id: string | null;
  source_invoice_number?: string | null;
  source_return_id: string | null;
  source_return_number?: string | null;
  source_type: CustomerCreditNoteSourceType;
  credit_note_date: string;
  status: CustomerCreditNoteStatus;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total_ttc: number;
  applied_amount: number;
  available_amount: number;
  currency: string;
  reason: string | null;
  internal_notes: string | null;
  notes: string | null;
  validated_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type CustomerCreditNoteLineRecord = {
  id: string;
  credit_note_id: string;
  source_invoice_line_id: string | null;
  line_order: number;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_id: string | null;
  unit_name: string | null;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id: string | null;
  tax_rate: number;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
};

export type CreditNoteApplicationRecord = {
  id: string;
  credit_note_id: string;
  invoice_id: string;
  invoice_number?: string | null;
  amount: number;
  application_date: string;
  cancelled_at: string | null;
};

export type CustomerCreditNoteDetail = {
  creditNote: CustomerCreditNoteRecord | null;
  lines: CustomerCreditNoteLineRecord[];
  applications: CreditNoteApplicationRecord[];
};

export type CreditNoteLineFormValue = {
  id: string;
  source_invoice_line_id?: string | null;
  source_return_line_id?: string | null;
  price_source?: "invoice" | "order" | "delivery" | "product" | "missing" | null;
  product_id?: string | null;
  product_name?: string | null;
  description: string;
  quantity: number;
  unit_id?: string | null;
  unit_name?: string | null;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id?: string | null;
  tax_rate: number;
};

export type CreditNoteCounters = {
  draft: number;
  validated: number;
  availableTotal: number;
  availableCount: number;
};

export type CreditNoteReturnPreparationLine = InvoiceLineFormValue & {
  return_line_id: string;
  source_delivery_line_id: string | null;
  quantity_returned: number;
  source_invoice_line_id?: string | null;
  source_return_line_id?: string | null;
  price_source?: "invoice" | "order" | "delivery" | "product" | "missing" | null;
};

export type CreditNoteReturnPreparation = {
  returnDocument: {
    id: string;
    document_number: string;
    customer_id: string;
    status: string;
    return_reason: string | null;
    related_delivery_id: string | null;
    related_order_id: string | null;
    stock_updated_at: string | null;
  } | null;
  customer: { id: string; name: string | null } | null;
  relatedDelivery: { id: string; document_number: string } | null;
  relatedOrder: { id: string; document_number: string } | null;
  relatedInvoice: { id: string; invoice_number: string } | null;
  existingCreditNote: CustomerCreditNoteRecord | null;
  lines: CreditNoteReturnPreparationLine[];
};

export type CreditNoteActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const CREDIT_NOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Valide",
  partially_applied: "Partiellement affecte",
  applied: "Affecte",
  cancelled: "Annule",
};

export const CREDIT_NOTE_SOURCE_LABELS: Record<string, string> = {
  manual: "Libre",
  invoice_total: "Facture totale",
  invoice_partial: "Facture partielle",
  return: "Retour client",
  commercial_gesture: "Geste commercial",
  correction: "Correction",
};
