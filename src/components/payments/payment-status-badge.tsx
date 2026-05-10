import { Badge } from "@/components/ui/badge";
import { CUSTOMER_PAYMENT_STATUS_LABELS } from "@/lib/payment-types";

export function PaymentStatusBadge({ status }: { status: string }) {
  const tone = status === "cancelled" ? "danger" : status === "allocated" ? "success" : status === "partially_allocated" ? "warning" : "info";
  return <Badge tone={tone}>{CUSTOMER_PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}
