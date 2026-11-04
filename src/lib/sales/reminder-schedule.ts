export function nextReminderDate(dueDate: string, daysAfterDue: number, today: string): string | null {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  const target = due + daysAfterDue * 86_400_000;
  if (now < target) return new Date(target).toISOString().slice(0, 10);
  return today;
}

export type ReminderRuleMatch = { id: string; daysAfterDue: number; level: number; active: boolean; subject?: string | null; message?: string | null };

/** La règle active dont le délai est le plus long parmi celles déjà atteintes. */
export function matchingReminderRule(rules: ReminderRuleMatch[], daysOverdue: number) {
  return rules
    .filter((rule) => rule.active && daysOverdue >= rule.daysAfterDue)
    .sort((left, right) => right.daysAfterDue - left.daysAfterDue)[0] ?? null;
}

export function dueForReminder(invoices: { id: string; dueDate: string; remaining: number }[], daysAfterDue: number, today: string) {
  return invoices.filter((invoice) => invoice.remaining > 0.009 && nextReminderDate(invoice.dueDate, daysAfterDue, today) === today && Date.parse(`${invoice.dueDate}T00:00:00Z`) + daysAfterDue * 86_400_000 <= Date.parse(`${today}T00:00:00Z`));
}
