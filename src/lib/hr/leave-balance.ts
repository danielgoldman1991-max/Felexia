/** 1,5 jour ouvrable par mois de service, soit 18 jours par an (code du travail). */
export function acquiredLeaveDays(monthsWorked: number): number {
  const months = Math.max(0, Math.min(12, Math.floor(monthsWorked)));
  return Math.round(months * 1.5 * 100) / 100;
}

export function leaveBalance(monthsWorked: number, takenDays: number) {
  const acquired = acquiredLeaveDays(monthsWorked);
  const taken = Math.round(Math.max(0, takenDays) * 100) / 100;
  return { acquired, taken, remaining: Math.round((acquired - taken) * 100) / 100 };
}
