/** Financial indicators include issued invoices, never drafts or cancellations. */
export const ISSUED_CUSTOMER_INVOICE_STATUSES = ["validated", "sent", "partially_paid", "paid", "overdue"] as const;

export function isIssuedCustomerInvoiceStatus(status: unknown): boolean {
  return ISSUED_CUSTOMER_INVOICE_STATUSES.some((issued) => issued === status);
}
