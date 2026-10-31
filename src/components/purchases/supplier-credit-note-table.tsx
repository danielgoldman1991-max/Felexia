import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatDocumentMoney } from "@/lib/print-format";
import { SUPPLIER_CREDIT_NOTE_STATUS_LABELS, type SupplierCreditNoteRecord } from "@/lib/supplier-credit-note-types";

export function SupplierCreditNoteTable({ rows }: { rows: SupplierCreditNoteRecord[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center"><h2 className="font-semibold">Aucun avoir fournisseur</h2><p className="mt-2 text-sm text-[var(--muted)]">Les avoirs reçus réduisent le montant de vos factures d’achat. Créez-en un depuis une facture ou en saisie libre.</p></div>;
  return <Table><thead><tr><Th>Avoir et référence fournisseur</Th><Th>Fournisseur</Th><Th>Date</Th><Th>Statut</Th><Th className="text-right">Total TTC</Th><Th className="text-right">Disponible</Th><Th><span className="sr-only">Consulter</span></Th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
    <Td><Link href={`/achats/avoirs/${row.id}`} className="font-semibold text-[var(--primary)] hover:underline">{row.credit_note_number}</Link><p className="mt-1 text-xs text-[var(--muted)]">{row.supplier_credit_note_number}</p></Td>
    <Td>{row.supplier_name ?? "—"}</Td><Td>{formatDate(row.credit_note_date)}</Td><Td><Badge tone={row.status === "cancelled" ? "danger" : row.status === "draft" ? "neutral" : row.status === "applied" ? "success" : "info"}>{SUPPLIER_CREDIT_NOTE_STATUS_LABELS[row.status] ?? row.status}</Badge></Td>
    <Td className="text-right font-mono tabular-nums">{formatDocumentMoney(row.total_ttc, row.currency)}</Td><Td className="text-right font-mono tabular-nums">{formatDocumentMoney(row.available_amount, row.currency)}</Td><Td><Link href={`/achats/avoirs/${row.id}`} aria-label={`Consulter l’avoir ${row.credit_note_number}`} className="inline-flex rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--surface-soft)]"><ArrowUpRight className="h-4 w-4" /></Link></Td>
  </tr>)}</tbody></Table>;
}
