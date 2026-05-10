import { Badge } from "@/components/ui/badge";
import { SUPPLIER_ORDER_STATUS_LABELS, SUPPLIER_RECEIPT_STATUS_LABELS } from "@/lib/purchase-types";

export function SupplierOrderStatusBadge({ status }: { status: string }) {
  const tones: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
    draft: "neutral",
    sent: "info",
    confirmed: "success",
    partially_received: "warning",
    received: "success",
    cancelled: "danger",
  };
  return <Badge tone={tones[status] ?? "neutral"}>{SUPPLIER_ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function SupplierReceiptStatusBadge({ status }: { status: string }) {
  const tones: Record<string, "neutral" | "success" | "danger"> = {
    draft: "neutral",
    validated: "success",
    cancelled: "danger",
  };
  return <Badge tone={tones[status] ?? "neutral"}>{SUPPLIER_RECEIPT_STATUS_LABELS[status] ?? status}</Badge>;
}
