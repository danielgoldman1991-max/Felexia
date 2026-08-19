import Link from "next/link";
import { Eye, Link2, Printer } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { CreditNoteStatusBadge } from "@/components/credit-notes/credit-note-status-badge";
import { CREDIT_NOTE_SOURCE_LABELS, type CustomerCreditNoteRecord } from "@/lib/credit-note-types";
import { formatDate } from "@/lib/format";

export function CustomerCreditNotesTable({ rows }: { rows: CustomerCreditNoteRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun avoir" description="Les avoirs clients crees apparaitront ici." />;
  return (
    <Table>
      <thead><tr><Th>Numero</Th><Th>Client</Th><Th>Date</Th><Th>Origine</Th><Th>Statut</Th><Th>Total TTC</Th><Th>Utilise</Th><Th>Disponible</Th><Th>Actions</Th></tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={row.id}>
          <Td><Link className="font-medium text-indigo-700 hover:underline" href={`/facturation/avoirs/${row.id}`}>{row.credit_note_number}</Link></Td>
          <Td>{row.customer_name ?? "-"}</Td>
          <Td>{formatDate(row.credit_note_date)}</Td>
          <Td>{CREDIT_NOTE_SOURCE_LABELS[row.source_type] ?? row.source_type}</Td>
          <Td><CreditNoteStatusBadge status={row.status} /></Td>
          <Td><MoneyDisplay value={row.total_ttc} /></Td>
          <Td><MoneyDisplay value={row.applied_amount} /></Td>
          <Td><MoneyDisplay value={row.available_amount} /></Td>
          <Td><div className="flex gap-1"><Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Voir" asChild><Link href={`/facturation/avoirs/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>{row.available_amount > 0 ? <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Affecter" asChild><Link href={`/facturation/avoirs/${row.id}/affecter`}><Link2 className="h-4 w-4" /></Link></Button> : null}<Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Imprimer" asChild><Link href={`/facturation/avoirs/${row.id}/print`} target="_blank"><Printer className="h-4 w-4" /></Link></Button></div></Td>
        </tr>
      ))}</tbody>
    </Table>
  );
}
