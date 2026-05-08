export const APP_NAME = "Felexia";
export const DEFAULT_CURRENCY = "MAD";

export const DOCUMENT_STATUSES = {
  quote: ["draft", "sent", "accepted", "rejected", "expired", "converted"],
  salesOrder: [
    "draft",
    "confirmed",
    "partially_delivered",
    "delivered",
    "partially_invoiced",
    "invoiced",
    "cancelled",
  ],
  invoice: ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled", "credited"],
  payment: ["draft", "confirmed", "cancelled"],
} as const;

export const VAT_RATES = [0, 7, 10, 14, 20];
