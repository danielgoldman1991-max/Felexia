export type FiscalPeriod = {
  id: string;
  start: string;
  end: string;
  locked: boolean;
};

export function periodsToLock(periods: FiscalPeriod[], closeOn: string): FiscalPeriod[] {
  return periods.filter((period) => !period.locked && period.end <= closeOn);
}

export function assertPeriodOpen(period: { locked: boolean } | null, label: string) {
  if (period?.locked) throw new Error(`La période ${label} est clôturée. Aucune écriture nouvelle n'est acceptée.`);
}
