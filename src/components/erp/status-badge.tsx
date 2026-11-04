import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/types";

const labels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  blocked: "Bloqué",
  archived: "Archivé",
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Rejeté",
  expired: "Expiré",
  converted: "Converti",
  confirmed: "Confirmé",
  partially_paid: "Partiellement payé",
  partially_delivered: "Partiellement livré",
  partially_received: "Partiellement reçu",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
  canceled: "Annulé",
  validated: "Validé",
  delivered: "Livré",
  received: "Reçu",
  awarded: "Attribué",
  open: "Ouvert",
  closed: "Clôturé",
  check: "Chèque",
  locked: "Verrouillé",
};

export function frenchStatusLabel(status: string | null | undefined) {
  if (!status) return "—";
  return labels[status] ?? status;
}

const tones: Record<string, StatusTone> = {
  active: "success",
  accepted: "success",
  paid: "success",
  confirmed: "success",
  validated: "success",
  delivered: "success",
  sent: "info",
  partially_paid: "warning",
  overdue: "danger",
  blocked: "danger",
  archived: "neutral",
  cancelled: "danger",
  rejected: "danger",
  expired: "warning",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={tones[status] ?? "neutral"}>{frenchStatusLabel(status)}</Badge>;
}
