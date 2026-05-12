import { Badge } from "@/components/ui/badge";
import { ENTRY_STATUS_LABELS, FISCAL_YEAR_STATUS_LABELS, PERIOD_STATUS_LABELS } from "@/lib/accounting-types";

export function EntryStatusBadge({ status }: { status: string }) {
  const tone = status === "posted" ? "success" : status === "cancelled" || status === "reversed" ? "warning" : "neutral";
  return <Badge tone={tone}>{ENTRY_STATUS_LABELS[status] ?? status}</Badge>;
}

export function FiscalYearStatusBadge({ status }: { status: string }) {
  const tone = status === "closed" ? "danger" : "success";
  return <Badge tone={tone}>{FISCAL_YEAR_STATUS_LABELS[status] ?? status}</Badge>;
}

export function PeriodStatusBadge({ status }: { status: string }) {
  const tone = status === "closed" ? "danger" : status === "locked" ? "warning" : "success";
  return <Badge tone={tone}>{PERIOD_STATUS_LABELS[status] ?? status}</Badge>;
}
