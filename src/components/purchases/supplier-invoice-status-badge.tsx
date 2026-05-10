import { Badge } from "@/components/ui/badge";
import { SUPPLIER_INVOICE_STATUS_LABELS } from "@/lib/purchase-types";

export function SupplierInvoiceStatusBadge({ status }: { status: string }) {
  const tones: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
    draft: "neutral",
    validated: "info",
    partially_paid: "warning",
    paid: "success",
    cancelled: "danger",
  };
  return <Badge tone={tones[status] ?? "neutral"}>{SUPPLIER_INVOICE_STATUS_LABELS[status] ?? status}</Badge>;
}
