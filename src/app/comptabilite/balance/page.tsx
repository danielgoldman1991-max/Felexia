import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { AccountingReportFilters } from "@/components/accounting/accounting-report-filters";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { getAccountingReportLines } from "@/lib/accounting";
import Link from "next/link";

export default async function BalancePage({ searchParams }: { searchParams: Promise<{ date_from?: string; date_to?: string }> }) {
  const filters = await searchParams;
  const lines = await getAccountingReportLines({ dateFrom: filters.date_from, dateTo: filters.date_to });
  const grouped = new Map<string, { code: string; label: string; debit: number; credit: number }>();
  for (const line of lines) {
    const current = grouped.get(line.account_id) ?? { code: line.account_code, label: line.account_label, debit: 0, credit: 0 };
    current.debit += line.debit;
    current.credit += line.credit;
    grouped.set(line.account_id, current);
  }
  const rows = [...grouped.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totals = rows.reduce((sum, row) => ({ debit: sum.debit + row.debit, credit: sum.credit + row.credit, debitBalance: sum.debitBalance + Math.max(row.debit - row.credit, 0), creditBalance: sum.creditBalance + Math.max(row.credit - row.debit, 0) }), { debit: 0, credit: 0, debitBalance: 0, creditBalance: 0 });
  return (
    <ModulePage>
      <PageHeader title="Balance des comptes" description="Mouvements et soldes de chaque compte sur la période." />
      <AccountingReportFilters dateFrom={filters.date_from} dateTo={filters.date_to} />
      {rows.length === 0 ? <EmptyState title="Aucune écriture comptabilisée" description="Validez une écriture ou élargissez la période affichée." action={<Link className="text-sm font-semibold text-[var(--primary)]" href="/comptabilite/ecritures">Voir les écritures</Link>} /> : (
        <div className="overflow-x-auto"><Table className="min-w-[900px]"><thead><tr><Th>Compte</Th><Th>Intitulé</Th><Th className="text-right">Mouvements débit</Th><Th className="text-right">Mouvements crédit</Th><Th className="text-right">Solde débiteur</Th><Th className="text-right">Solde créditeur</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.code}><Td className="font-medium">{row.code}</Td><Td>{row.label}</Td><Td className="text-right"><MoneyDisplay value={row.debit} /></Td><Td className="text-right"><MoneyDisplay value={row.credit} /></Td><Td className="text-right"><MoneyDisplay value={Math.max(row.debit - row.credit, 0)} /></Td><Td className="text-right"><MoneyDisplay value={Math.max(row.credit - row.debit, 0)} /></Td></tr>)}</tbody><tfoot><tr className="font-semibold"><Td colSpan={2}>Totaux</Td><Td className="text-right"><MoneyDisplay value={totals.debit} /></Td><Td className="text-right"><MoneyDisplay value={totals.credit} /></Td><Td className="text-right"><MoneyDisplay value={totals.debitBalance} /></Td><Td className="text-right"><MoneyDisplay value={totals.creditBalance} /></Td></tr></tfoot></Table></div>
      )}
    </ModulePage>
  );
}
