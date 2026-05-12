import Link from "next/link";
import { Eye } from "lucide-react";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { EntryStatusBadge } from "@/components/accounting/accounting-status-badge";
import { formatDate } from "@/lib/format";
import type { AccountingEntryRecord } from "@/lib/accounting-types";
import { Card, CardContent } from "@/components/ui/card";

type EntryWithJournal = AccountingEntryRecord & { journal_code?: string; journal_name?: string };

export function EntriesTable({
  rows,
  basePath = "/comptabilite/ecritures",
}: {
  rows: EntryWithJournal[];
  basePath?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Aucune ecriture" description="Les ecritures comptables apparaitront ici." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th><Th>Date</Th><Th>Journal</Th><Th>Libelle</Th><Th>Debit</Th><Th>Credit</Th><Th>Statut</Th><Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link
                href={`${basePath}/${row.id}`}
                className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                {row.entry_number}
              </Link>
            </Td>
            <Td>{formatDate(row.entry_date)}</Td>
            <Td>
              <span className="text-xs text-[var(--muted)]">{row.journal_code ?? "-"}</span>
            </Td>
            <Td className="max-w-xs truncate">{row.label}</Td>
            <Td><MoneyDisplay value={row.total_debit} /></Td>
            <Td><MoneyDisplay value={row.total_credit} /></Td>
            <Td><EntryStatusBadge status={row.status} /></Td>
            <Td>
              <Link
                href={`${basePath}/${row.id}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                title="Consulter l'ecriture"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function EntriesSummaryCards({
  entries,
}: {
  entries: EntryWithJournal[];
}) {
  const draftCount = entries.filter((e) => e.status === "draft").length;
  const totalDebit = entries.reduce((s, e) => s + Number(e.total_debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.total_credit), 0);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-[var(--muted)]">Total ecritures</p>
          <p className="mt-1 text-2xl font-semibold">{entries.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-[var(--muted)]">Brouillons</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--warning)]">{draftCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-[var(--muted)]">Total Debit</p>
          <p className="mt-1 text-2xl font-semibold"><MoneyDisplay value={totalDebit} /></p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-[var(--muted)]">Total Credit</p>
          <p className="mt-1 text-2xl font-semibold"><MoneyDisplay value={totalCredit} /></p>
        </CardContent>
      </Card>
    </div>
  );
}
