"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { allocatePaymentToInvoices } from "@/lib/payment-actions";
import type { CustomerPaymentRecord, OpenInvoiceForAllocation, PaymentActionResult } from "@/lib/payment-types";

export function PaymentAllocationForm({ payment, invoices }: { payment: CustomerPaymentRecord; invoices: OpenInvoiceForAllocation[] }) {
  const [state, formAction, pending] = useActionState<PaymentActionResult, FormData>(allocatePaymentToInvoices, { success: true });
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const rows = useMemo(() => Object.entries(allocations).map(([invoice_id, amount]) => ({ invoice_id, amount: Number(amount || 0) })).filter((row) => row.amount > 0), [allocations]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="payment_id" value={payment.id} />
      <input type="hidden" name="allocations" value={JSON.stringify(rows)} />
      <Card>
        <CardHeader><h2 className="font-semibold">Paiement a affecter</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs text-[var(--muted)]">Paiement</p><p className="font-semibold">{payment.payment_number}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Client</p><p>{payment.customer_name}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Disponible</p><p className="font-semibold"><MoneyDisplay value={payment.available_amount} /></p></div>
          <div><p className="text-xs text-[var(--muted)]">Affecte maintenant</p><p><MoneyDisplay value={total} /></p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Factures ouvertes</h2></CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Facture</Th><Th>Date</Th><Th>Total</Th><Th>Reste</Th><Th>Montant a affecter</Th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td>{invoice.invoice_number}</Td><Td>{invoice.invoice_date}</Td><Td><MoneyDisplay value={invoice.total_ttc} /></Td><Td><MoneyDisplay value={invoice.remaining_amount} /></Td>
                  <Td><Input type="number" min="0" max={invoice.remaining_amount} step="0.01" value={allocations[invoice.id] ?? 0} onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: Number(event.target.value || 0) }))} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href={`/facturation/paiements/${payment.id}`}>Annuler</Link></Button>
        <Button disabled={pending || total <= 0 || total > payment.available_amount}>Affecter le paiement</Button>
      </div>
    </form>
  );
}
