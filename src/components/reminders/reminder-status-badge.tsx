import { Badge } from "@/components/ui/badge";
import { REMINDER_STATUS_LABELS, type CustomerReminderStatus } from "@/lib/reminder-types";

export function ReminderStatusBadge({ status }: { status: CustomerReminderStatus }) {
  const tone = status === "sent" ? "success" : status === "cancelled" ? "danger" : "neutral";
  return <Badge tone={tone}>{REMINDER_STATUS_LABELS[status] ?? status}</Badge>;
}
