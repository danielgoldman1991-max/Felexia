export function nextReminderDate(dueDate: string, daysAfterDue: number, today: string): string | null {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  const target = due + Math.max(0, daysAfterDue) * 86_400_000;
  if (now < target) return new Date(target).toISOString().slice(0, 10);
  return today;
}

export function dueForReminder(invoices: { id: string; dueDate: string; remaining: number }[], daysAfterDue: number, today: string) {
  return invoices.filter((invoice) => invoice.remaining > 0.009 && nextReminderDate(invoice.dueDate, daysAfterDue, today) === today && Date.parse(`${invoice.dueDate}T00:00:00Z`) + daysAfterDue * 86_400_000 <= Date.parse(`${today}T00:00:00Z`));
}
