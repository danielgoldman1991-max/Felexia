import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/types";

const labels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  blocked: "Bloque",
  archived: "Archive",
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  rejected: "Rejete",
  expired: "Expire",
  converted: "Converti",
  confirmed: "Confirme",
  partially_paid: "Partiel",
  paid: "Paye",
  overdue: "En retard",
  cancelled: "Annule",
  validated: "Valide",
  delivered: "Livre",
};

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
  return <Badge tone={tones[status] ?? "neutral"}>{labels[status] ?? status}</Badge>;
}
