import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { AccountingReportFilters } from "@/components/accounting/accounting-report-filters";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { getAccountingReportLines } from "@/lib/accounting";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export default async function GeneralJournalPage({ searchParams }: { searchParams: Promise<{ date_from?: string; date_to?: string }> }) {
  const filters = await searchParams;
  const lines = await getAccountingReportLines({ dateFrom: filters.date_from, dateTo: filters.date_to });
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  return (
    <ModulePage>
      <PageHeader title="Journal général" description="Toutes les lignes des écritures comptabilisées, par ordre chronologique." />
      <AccountingReportFilters dateFrom={filters.date_from} dateTo={filters.date_to} />
      {lines.length === 0 ? (
        <EmptyState title="Aucune écriture comptabilisée" description="Validez une écriture ou élargissez la période affichée." action={<Link className="text-sm font-semibold text-[var(--primary)]" href="/comptabilite/ecritures">Voir les écritures</Link>} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <thead><tr><Th>Date</Th><Th>Journal</Th><Th>Pièce</Th><Th>Libellé</Th><Th>Compte</Th><Th className="text-right">Débit</Th><Th className="text-right">Crédit</Th></tr></thead>
            <tbody>
              {lines.map((line) => <tr key={line.id}><Td>{formatDate(line.entry_date)}</Td><Td>{line.journal_code || "-"}</Td><Td><Link className="font-medium text-[var(--primary)] hover:underline" href={`/comptabilite/ecritures/${line.entry_id}`}>{line.entry_number}</Link></Td><Td>{line.label || line.entry_label}</Td><Td>{line.account_code} · {line.account_label}</Td><Td className="text-right"><MoneyDisplay value={line.debit} /></Td><Td className="text-right"><MoneyDisplay value={line.credit} /></Td></tr>)}
            </tbody>
            <tfoot><tr className="font-semibold"><Td colSpan={5}>Totaux</Td><Td className="text-right"><MoneyDisplay value={totalDebit} /></Td><Td className="text-right"><MoneyDisplay value={totalCredit} /></Td></tr></tfoot>
          </Table>
        </div>
      )}
    </ModulePage>
  );
}
