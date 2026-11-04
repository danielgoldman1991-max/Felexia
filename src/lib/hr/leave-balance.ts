/** 1,5 jour ouvrable par mois de service, soit 18 jours par an (code du travail). */
export function acquiredLeaveDays(monthsWorked: number): number {
  const months = Math.max(0, Math.min(12, Math.floor(monthsWorked)));
  return Math.round(months * 1.5 * 100) / 100;
}

/** Mois de service comptés dans l'année civile, du mois d'entrée (ou janvier) jusqu'au mois courant inclus. */
export function serviceMonthsInYear(hireDate: string, year: number, asOf = new Date()): number {
  const hire = new Date(`${hireDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(hire.getTime())) return 0;
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const asOfUtc = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const end = asOfUtc < yearEnd ? asOfUtc : yearEnd;
  const from = hire > yearStart ? hire : yearStart;
  if (from.getUTCFullYear() > year || from > end) return 0;
  const months = (end.getUTCMonth() - from.getUTCMonth()) + 1;
  return Math.max(0, Math.min(12, months));
}

/** Vrai lorsque deux périodes de congé se chevauchent, bornes incluses. */
export function leaveRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  const a0 = startA.slice(0, 10);
  const a1 = (endA || startA).slice(0, 10);
  const b0 = startB.slice(0, 10);
  const b1 = (endB || startB).slice(0, 10);
  return a0 <= b1 && b0 <= a1;
}

export const LEAVE_OVERLAP_MESSAGE = "Ce salarié a déjà un congé qui chevauche cette période. Modifiez les dates ou annulez l'autre demande.";

export function hrDatabaseErrorMessage(message: string) {
  if (message.includes("HR_LEAVE_OVERLAP") || message.includes("23P01") || /exclusion/i.test(message)) return LEAVE_OVERLAP_MESSAGE;
  if (message.includes("PAYROLL_LOCKED")) return "Ce bulletin est figé. Les montants ne peuvent plus être modifiés.";
  if (message.includes("PAYROLL_STATUS_TRANSITION") || message.includes("PAYROLL_PREPARATORY_ONLY")) return "Passez le bulletin de brouillon à validé, puis à payé.";
  if (message.includes("deduction_month") || message.includes("deduction_year")) return "Le mois de retenue de l'avance est invalide.";
  if (message.includes("23505") || /duplicate key|unique constraint/i.test(message)) return "Cet enregistrement existe déjà.";
  if (message.includes("23514") || message.includes("23502") || /check constraint|not-null/i.test(message)) return "Les données ne respectent pas les contrôles. Vérifiez les dates, les montants et les champs obligatoires.";
  if (/^[A-Z0-9_]+$/.test(message.trim())) return "L'enregistrement n'a pas pu être sauvegardé. Vérifiez les informations saisies.";
  return message || "L'enregistrement n'a pas pu être sauvegardé.";
}

export function isNextControlFlow(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: string }).digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

export function leaveBalance(monthsWorked: number, takenDays: number) {
  const acquired = acquiredLeaveDays(monthsWorked);
  const taken = Math.round(Math.max(0, takenDays) * 100) / 100;
  return { acquired, taken, remaining: Math.round((acquired - taken) * 100) / 100 };
}
