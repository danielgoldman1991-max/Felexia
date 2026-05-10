import { Badge } from "@/components/ui/badge";
import { CREDIT_NOTE_STATUS_LABELS, type CustomerCreditNoteStatus } from "@/lib/credit-note-types";

export function CreditNoteStatusBadge({ status }: { status: CustomerCreditNoteStatus }) {
  const tone = status === "validated" ? "success" : status === "cancelled" ? "danger" : status.includes("applied") ? "info" : "neutral";
  return <Badge tone={tone}>{CREDIT_NOTE_STATUS_LABELS[status] ?? status}</Badge>;
}
