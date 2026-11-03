export type OpenInvoice = {
  id: string;
  number: string;
  customer: string;
  dueDate: string | null;
  remaining: number;
};

export type AgingBucket = "not_due" | "1_30" | "31_60" | "61_90" | "over_90" | "no_due";

export function agingBucket(dueDate: string | null, today: string, remaining: number): AgingBucket | null {
  if (remaining <= 0.009) return null;
  if (!dueDate) return "no_due";
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return "no_due";
  const days = Math.floor((now - due) / 86_400_000);
  if (days <= 0) return "not_due";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "over_90";
}

export function summarizeAging(invoices: OpenInvoice[], today: string) {
  const totals: Record<AgingBucket, number> = { not_due: 0, "1_30": 0, "31_60": 0, "61_90": 0, over_90: 0, no_due: 0 };
  const rows = invoices.flatMap((invoice) => {
    const bucket = agingBucket(invoice.dueDate, today, invoice.remaining);
    if (!bucket) return [];
    totals[bucket] = Math.round((totals[bucket] + invoice.remaining) * 100) / 100;
    return [{ ...invoice, bucket }];
  });
  return { rows, totals, total: Object.values(totals).reduce((sum, value) => sum + value, 0) };
}
