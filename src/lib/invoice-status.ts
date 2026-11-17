/** Financial indicators include issued invoices, never drafts or cancellations. */
export const ISSUED_CUSTOMER_INVOICE_STATUSES = ["validated", "sent", "partially_paid", "paid", "overdue"] as const;

export function isIssuedCustomerInvoiceStatus(status: unknown): boolean {
  return ISSUED_CUSTOMER_INVOICE_STATUSES.some((issued) => issued === status);
}

/** Single rule for paid, partially paid and overdue. Restore writes this result. */
export function invoiceLifecycleStatus(input: {
  status: string;
  dueDate: string | null;
  total: number;
  paid: number;
  credit: number;
  today: string;
}) {
  const remaining = Math.max(input.total - input.paid - input.credit, 0);
  const paymentStatus = input.paid + input.credit <= 0 ? "unpaid" : remaining <= 0 ? "paid" : "partial";
  if (input.status === "draft" || input.status === "cancelled") return { status: input.status, paymentStatus };
  if (paymentStatus === "paid") return { status: "paid", paymentStatus };
  if (paymentStatus === "partial") return { status: "partially_paid", paymentStatus };
  if (input.dueDate && input.dueDate < input.today) return { status: "overdue", paymentStatus };
  if (input.status === "sent") return { status: "sent", paymentStatus: "unpaid" as const };
  return { status: "validated", paymentStatus: "unpaid" as const };
}
