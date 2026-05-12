import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";

export function AccountingJournalSummaryCards({
  entriesCount,
  totalDebit,
  totalCredit,
  periodLabel,
}: {
  entriesCount: number;
  totalDebit: number;
  totalCredit: number;
  periodLabel: string;
}) {
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) < 0.01;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Ecritures</p><p className="mt-1 text-2xl font-semibold">{entriesCount}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Total debit</p><p className="mt-1 text-xl font-semibold"><MoneyDisplay value={totalDebit} /></p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Total credit</p><p className="mt-1 text-xl font-semibold"><MoneyDisplay value={totalCredit} /></p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Difference</p><p className="mt-1 text-xl font-semibold"><MoneyDisplay value={diff} /></p></CardContent></Card>
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs text-[var(--muted)]">Periode</p>
          <p className="text-sm font-medium">{periodLabel}</p>
          <Badge tone={balanced ? "success" : "danger"}>{balanced ? "Journal equilibre" : "Ecart detecte"}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
