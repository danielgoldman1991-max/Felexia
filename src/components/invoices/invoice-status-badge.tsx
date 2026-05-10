import { Badge } from "@/components/ui/badge";
import { INVOICE_PAYMENT_STATUS_LABELS, INVOICE_STATUS_LABELS } from "@/lib/invoice-types";

export function InvoiceStatusBadge({ status }: { status: string }) {
  const tone = status === "paid" || status === "validated" || status === "sent"
    ? "success"
    : status === "cancelled"
      ? "danger"
      : status === "overdue"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{INVOICE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function InvoicePaymentStatusBadge({ status }: { status: string }) {
  const tone = status === "paid" ? "success" : status === "partial" ? "warning" : "neutral";
  return <Badge tone={tone}>{INVOICE_PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}
