export const APP_NAME = "Felexia";
export const DEFAULT_CURRENCY = "MAD";

// Stored sales statuses. Order billing progress is derived from invoices and
// delivery notes, not from partially_invoiced / invoiced values.
export const DOCUMENT_STATUSES = {
  quote: ["draft", "sent", "accepted", "rejected", "converted", "cancelled"],
  salesOrder: ["draft", "confirmed", "partially_delivered", "delivered", "cancelled"],
  invoice: ["draft", "validated", "sent", "partially_paid", "paid", "overdue", "cancelled"],
  payment: ["draft", "confirmed", "cancelled"],
} as const;

export const VAT_RATES = [0, 7, 10, 14, 20];
