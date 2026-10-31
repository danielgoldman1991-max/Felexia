import Link from "next/link";
import { BookOpen, Download, Eye, Printer } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/erp/empty-state";
import { JOURNAL_TYPE_LABELS } from "@/lib/accounting-types";
import type { AccountingJournalWithStats } from "@/lib/accounting-types";
import { formatDate } from "@/lib/format";

export function JournalsTable({ rows }: { rows: AccountingJournalWithStats[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Vos journaux ne sont pas encore disponibles" description="Les journaux regroupent les écritures de vos ventes, achats et règlements." icon={<BookOpen className="h-6 w-6" />} />;
  }

  const typeTone = (type: string) => {
    switch (type) {
      case "sales": return "success";
      case "purchases": return "warning";
      case "bank": return "info";
      case "cash": return "neutral";
      case "od": return "danger";
      default: return "neutral";
    }
  };

  return (
    <Table className="[&_th]:px-3 [&_td]:px-3">
      <thead>
        <tr>
          <Th>Journal</Th><Th className="text-right">Écritures</Th><Th className="text-right">Total débit</Th><Th className="text-right">Total crédit</Th><Th>Dernière écriture</Th><Th>Statut</Th><Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link href={`/comptabilite/journaux/${row.id}`} title={row.name} className="block max-w-52 truncate font-medium hover:text-[var(--primary)]">{row.name}</Link>
              <div className="mt-1.5 flex items-center gap-2"><span className="font-mono text-xs text-[var(--muted)]">{row.code}</span><Badge tone={typeTone(row.type)}>{JOURNAL_TYPE_LABELS[row.type] ?? row.type}</Badge></div>
            </Td>
            <Td className="text-right tabular-nums">{row.entries_count}</Td>
            <Td className="whitespace-nowrap text-right tabular-nums"><MoneyDisplay value={row.total_debit} /></Td>
            <Td className="whitespace-nowrap text-right tabular-nums"><MoneyDisplay value={row.total_credit} /></Td>
            <Td className="whitespace-nowrap">{row.last_entry_date ? formatDate(row.last_entry_date) : "—"}</Td>
            <Td>
              <Badge tone={row.is_active ? "success" : "danger"}>{row.is_active ? "Actif" : "Inactif"}</Badge>
            </Td>
            <Td>
              <div className="flex items-center gap-1">
                <Link href={`/comptabilite/journaux/${row.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Consulter">
                  <Eye className="h-4 w-4" />
                </Link>
                <Link href={`/comptabilite/journaux/${row.id}/print`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Imprimer">
                  <Printer className="h-4 w-4" />
                </Link>
                <Link href={`/comptabilite/journaux/${row.id}/export`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Exporter Excel">
                  <Download className="h-4 w-4" />
                </Link>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
