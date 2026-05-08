import { Badge } from "@/components/ui/badge";
import { SALES_STATUS_LABELS } from "@/lib/sales-types";

const toneByStatus: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  converted: "success",
  confirmed: "info",
  validated: "warning",
  delivered: "success",
  cancelled: "danger",
};

export function SalesStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={toneByStatus[status] ?? "neutral"}>
      {SALES_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
