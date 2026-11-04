export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeaveDecision = "approve" | "reject" | "cancel";

export type LeaveDecisionInput = {
  status: LeaveStatus;
  days: number;
  remainingDays: number;
  decision: LeaveDecision;
  /** Les congés sans solde ou non décomptés ne modifient pas le solde. */
  countsAgainstBalance: boolean;
};

export type LeaveDecisionResult = {
  ok: boolean;
  message: string;
  nextStatus: LeaveStatus;
  takenDelta: number;
};

const statuses = new Set<LeaveStatus>(["pending", "approved", "rejected", "cancelled"]);
const decisions = new Set<LeaveDecision>(["approve", "reject", "cancel"]);

/** Décision pure : la persistance et la notification sont faites par l'action serveur. */
export function decideLeave(input: LeaveDecisionInput): LeaveDecisionResult {
  const days = round2(input.days);
  if (!statuses.has(input.status) || !decisions.has(input.decision)) {
    return refuse(input.status, "Décision ou statut inconnu.");
  }
  if (!(days > 0)) return refuse(input.status, "Le nombre de jours doit être supérieur à zéro.");
  if (input.decision === "approve") {
    if (input.status !== "pending") return refuse(input.status, "Seule une demande en attente peut être acceptée.");
    if (input.countsAgainstBalance && round2(input.remainingDays) + 0.001 < days) {
      return refuse(input.status, `Solde insuffisant : ${round2(input.remainingDays)} jour(s) restant(s) pour ${days} jour(s) demandés.`);
    }
    return {
      ok: true,
      message: "Demande acceptée. Le solde est mis à jour.",
      nextStatus: "approved",
      takenDelta: input.countsAgainstBalance ? days : 0,
    };
  }
  if (input.decision === "reject") {
    if (input.status !== "pending") return refuse(input.status, "Seule une demande en attente peut être refusée.");
    return { ok: true, message: "Demande refusée. Le solde n'est pas modifié.", nextStatus: "rejected", takenDelta: 0 };
  }
  if (input.status === "approved") {
    return {
      ok: true,
      message: "Acceptation annulée. Les jours sont recrédités.",
      nextStatus: "cancelled",
      takenDelta: input.countsAgainstBalance ? -days : 0,
    };
  }
  if (input.status === "pending") {
    return { ok: true, message: "Demande annulée.", nextStatus: "cancelled", takenDelta: 0 };
  }
  return refuse(input.status, "Cette demande ne peut plus être annulée.");
}

function refuse(status: LeaveStatus, message: string): LeaveDecisionResult {
  return { ok: false, message, nextStatus: status, takenDelta: 0 };
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
