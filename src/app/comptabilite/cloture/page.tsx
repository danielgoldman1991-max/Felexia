import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { PeriodLockButton } from "@/components/accounting/period-lock-button";
import { listAccountingPeriods } from "@/lib/accounting-actions";
import { formatDate } from "@/lib/format";
import type { AccountingPeriodRecord } from "@/lib/accounting-types";

export const dynamic = "force-dynamic";

export default async function ClosePage() {
  const periodsResult = await listAccountingPeriods();
  const periods = periodsResult.success && periodsResult.data ? periodsResult.data as AccountingPeriodRecord[] : [];
  return (
    <ModulePage>
      <PageHeader title="Clôture" description="Verrouillez un mois pour refuser les validations et les écritures datées dans cette période. Le déverrouillage est réservé au comptable." />
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
        {periods.map((period) => {
          const locked = period.status === "locked" || period.status === "closed" || Boolean((period as { locked_at?: string | null }).locked_at);
          return (
            <li key={period.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{period.name}</p>
                <p className="text-sm text-[var(--muted)]">{formatDate(period.start_date)} – {formatDate(period.end_date)} · {locked ? "Verrouillée" : "Ouverte"}</p>
              </div>
              <PeriodLockButton periodId={period.id} locked={locked} />
            </li>
          );
        })}
      </ul>
      {periods.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun exercice ouvert. Créez-le depuis Exercices.</p> : null}
    </ModulePage>
  );
}
