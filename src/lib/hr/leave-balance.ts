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

export function leaveBalance(monthsWorked: number, takenDays: number) {
  const acquired = acquiredLeaveDays(monthsWorked);
  const taken = Math.round(Math.max(0, takenDays) * 100) / 100;
  return { acquired, taken, remaining: Math.round((acquired - taken) * 100) / 100 };
}
