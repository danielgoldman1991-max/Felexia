import Link from "next/link";
import { Eye } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { AccountingSourceBadge } from "@/components/accounting/accounting-source-badge";
import { EntryStatusBadge } from "@/components/accounting/accounting-status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { AccountingJournalEntryRow } from "@/lib/accounting-types";

export function AccountingJournalEntriesTable({ entries }: { entries: AccountingJournalEntryRow[] }) {
  if (entries.length === 0) {
    return <EmptyState title="Aucune ecriture" description="Aucune ecriture ne correspond aux filtres." />;
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th><Th>N ecriture</Th><Th>Source</Th><Th>Reference</Th><Th>Libelle</Th><Th>Debit</Th><Th>Credit</Th><Th>Statut</Th><Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <Td>{formatDate(entry.entry_date)}</Td>
            <Td>
              <Link href={`/comptabilite/ecritures/${entry.id}`} className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline">
                {entry.entry_number}
              </Link>
            </Td>
            <Td><AccountingSourceBadge source={entry.source_document_type} number={entry.source_number} /></Td>
            <Td>{entry.reference ?? "-"}</Td>
            <Td className="max-w-sm truncate">{entry.label}</Td>
            <Td><MoneyDisplay value={entry.total_debit} /></Td>
            <Td><MoneyDisplay value={entry.total_credit} /></Td>
            <Td><EntryStatusBadge status={entry.status} /></Td>
            <Td>
              <Link href={`/comptabilite/ecritures/${entry.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Voir ecriture">
                <Eye className="h-4 w-4" />
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
