import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { FiscalYearStatusBadge } from "@/components/accounting/accounting-status-badge";
import { listAccountingFiscalYears, listAccountingPeriods } from "@/lib/accounting-actions";
import { formatDate } from "@/lib/format";
import type { AccountingFiscalYearRecord, AccountingPeriodRecord } from "@/lib/accounting-types";

export default async function FiscalYearsPage() {
  const [fyResult, periodsResult] = await Promise.all([
    listAccountingFiscalYears(),
    listAccountingPeriods(),
  ]);

  const fiscalYears = fyResult.success && fyResult.data
    ? fyResult.data as AccountingFiscalYearRecord[]
    : [];
  const periods = periodsResult.success && periodsResult.data
    ? periodsResult.data as AccountingPeriodRecord[]
    : [];

  return (
    <ModulePage>
      <PageHeader title="Exercices" description="Exercices comptables et periodes associees." />
      <div className="space-y-8">
        {fiscalYears.length === 0 ? (
          <EmptyState title="Aucun exercice" description="Les exercices sont crees automatiquement a l'initialisation." />
        ) : (
          fiscalYears.map((fy) => {
            const fyPeriods = periods.filter((p) => p.fiscal_year_id === fy.id);
            return (
              <div key={fy.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{fy.name}</h3>
                    <p className="text-xs text-[var(--muted)]">
                      Du {formatDate(fy.start_date)} au {formatDate(fy.end_date)}
                    </p>
                  </div>
                  <FiscalYearStatusBadge status={fy.status} />
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th>Periode</Th><Th>Debut</Th><Th>Fin</Th><Th>Statut</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {fyPeriods.map((p) => (
                      <tr key={p.id}>
                        <Td className="font-medium">{p.name}</Td>
                        <Td>{formatDate(p.start_date)}</Td>
                        <Td>{formatDate(p.end_date)}</Td>
                        <Td><span className={`text-xs font-medium ${p.status === "open" ? "text-[var(--success)]" : p.status === "locked" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}>{p.status}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            );
          })
        )}
      </div>
    </ModulePage>
  );
}
