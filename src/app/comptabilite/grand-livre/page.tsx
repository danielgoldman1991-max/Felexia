import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { AccountingReportFilters } from "@/components/accounting/accounting-report-filters";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getAccountingReportLines } from "@/lib/accounting";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export default async function GeneralLedgerPage({ searchParams }: { searchParams: Promise<{ date_from?: string; date_to?: string }> }) {
  const filters = await searchParams;
  const lines = await getAccountingReportLines({ dateFrom: filters.date_from, dateTo: filters.date_to });
  const grouped = new Map<string, typeof lines>();
  for (const line of lines) grouped.set(line.account_id, [...(grouped.get(line.account_id) ?? []), line]);
  const accounts = [...grouped.entries()].sort(([, a], [, b]) => (a[0]?.account_code ?? "").localeCompare(b[0]?.account_code ?? ""));
  return (
    <ModulePage>
      <PageHeader title="Grand livre" description="Détail chronologique des mouvements et solde progressif par compte." />
      <AccountingReportFilters dateFrom={filters.date_from} dateTo={filters.date_to} />
      {accounts.length === 0 ? <EmptyState title="Aucune écriture comptabilisée" description="Validez une écriture ou élargissez la période affichée." action={<Link className="text-sm font-semibold text-[var(--primary)]" href="/comptabilite/ecritures">Voir les écritures</Link>} /> : accounts.map(([accountId, accountLines]) => {
        let runningBalance = 0;
        const debit = accountLines.reduce((sum, line) => sum + line.debit, 0);
        const credit = accountLines.reduce((sum, line) => sum + line.credit, 0);
        return <Card key={accountId}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{accountLines[0].account_code} · {accountLines[0].account_label}</h2><span className="text-sm text-[var(--muted)]">Solde : <MoneyDisplay value={debit - credit} /></span></div></CardHeader><CardContent className="p-0"><Table className="min-w-[900px]" containerClassName="border-0 shadow-none"><thead><tr><Th>Date</Th><Th>Pièce</Th><Th>Libellé</Th><Th className="text-right">Débit</Th><Th className="text-right">Crédit</Th><Th className="text-right">Solde</Th></tr></thead><tbody>{accountLines.map((line) => { runningBalance += line.debit - line.credit; return <tr key={line.id}><Td>{formatDate(line.entry_date)}</Td><Td><Link className="font-medium text-[var(--primary)] hover:underline" href={`/comptabilite/ecritures/${line.entry_id}`}>{line.entry_number}</Link></Td><Td>{line.label || line.entry_label}</Td><Td className="text-right"><MoneyDisplay value={line.debit} /></Td><Td className="text-right"><MoneyDisplay value={line.credit} /></Td><Td className="text-right"><MoneyDisplay value={runningBalance} /></Td></tr>; })}</tbody></Table></CardContent></Card>;
      })}
    </ModulePage>
  );
}
