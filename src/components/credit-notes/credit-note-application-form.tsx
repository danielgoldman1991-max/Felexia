"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { applyCreditNoteToInvoices } from "@/lib/credit-note-actions";
import type { CreditNoteActionResult, CustomerCreditNoteRecord } from "@/lib/credit-note-types";
import { formatDate } from "@/lib/format";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_ttc: number;
  paid_amount: number;
  credit_amount: number;
  remaining_amount: number;
};

export function CreditNoteApplicationForm({ creditNote, invoices }: { creditNote: CustomerCreditNoteRecord; invoices: InvoiceRow[] }) {
  const [state, formAction, pending] = useActionState<CreditNoteActionResult, FormData>(applyCreditNoteToInvoices, { success: true });
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const rows = useMemo(() => Object.entries(allocations).map(([invoice_id, amount]) => ({ invoice_id, amount: Number(amount || 0) })).filter((row) => row.amount > 0), [allocations]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="credit_note_id" value={creditNote.id} />
      <input type="hidden" name="applications" value={JSON.stringify(rows)} />
      <Card><CardHeader><h2 className="font-semibold">Avoir a affecter</h2></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><div>{creditNote.credit_note_number}</div><div>Total : <MoneyDisplay value={creditNote.total_ttc} /></div><div>Disponible : <MoneyDisplay value={creditNote.available_amount} /></div><div>Affecte maintenant : <MoneyDisplay value={total} /></div></CardContent></Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Factures ouvertes</h2></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 text-sm">
              <p className="font-semibold text-[var(--foreground)]">Aucune facture ouverte pour ce client.</p>
              <p className="mt-2 text-[var(--muted)]">
                L&apos;avoir reste disponible. Vous pourrez l&apos;affecter à une prochaine facture ou enregistrer un remboursement au client depuis la trésorerie, selon votre processus métier.
              </p>
              <Link href="/tresorerie/mouvements/new" className="mt-3 inline-flex font-semibold text-[var(--primary)] hover:underline">Enregistrer un remboursement</Link>
            </div>
          ) : <Table>
            <thead><tr><Th>Facture</Th><Th>Date</Th><Th>Echeance</Th><Th>Total</Th><Th>Paye</Th><Th>Avoirs</Th><Th>Reste</Th><Th>Affecter</Th></tr></thead>
            <tbody>{invoices.map((invoice) => <tr key={invoice.id}><Td>{invoice.invoice_number}</Td><Td>{formatDate(invoice.invoice_date)}</Td><Td>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</Td><Td><MoneyDisplay value={invoice.total_ttc} /></Td><Td><MoneyDisplay value={invoice.paid_amount} /></Td><Td><MoneyDisplay value={invoice.credit_amount} /></Td><Td><MoneyDisplay value={invoice.remaining_amount} /></Td><Td><Input type="number" min="0" max={invoice.remaining_amount} step="0.01" value={allocations[invoice.id] ?? 0} onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: Number(event.target.value || 0) }))} /></Td></tr>)}</tbody>
          </Table>}
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" asChild><Link href={`/facturation/avoirs/${creditNote.id}`}>Annuler</Link></Button><Button disabled={pending || total <= 0 || total > creditNote.available_amount}>Affecter l&apos;avoir</Button></div>
    </form>
  );
}
