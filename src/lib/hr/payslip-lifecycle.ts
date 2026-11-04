export const PAYSLIP_STATUSES = ["draft", "calculated", "validated", "paid"] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export function payslipStatusLabel(status: string) {
  if (status === "draft") return "Brouillon";
  if (status === "calculated") return "Calculé";
  if (status === "validated") return "Validé";
  if (status === "paid") return "Payé";
  return status;
}

export function payslipAmountsLocked(status: string) {
  return status === "validated" || status === "paid";
}

/** Brouillon ou calculé -> validé -> payé. Pas de retour en arrière. */
export function canTransitionPayslip(from: string, to: string) {
  if (from === to) return true;
  if ((from === "draft" || from === "calculated") && to === "validated") return true;
  if (from === "validated" && to === "paid") return true;
  return false;
}
