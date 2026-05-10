"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Printer, XCircle } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { cancelCustomerPayment, unallocatePaymentFromInvoice } from "@/lib/payment-actions";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { formatDate } from "@/lib/format";
import type { CustomerPaymentAllocationRecord, CustomerPaymentRecord, PaymentActionResult } from "@/lib/payment-types";

function actionWithId(action: (prev: PaymentActionResult, formData: FormData) => Promise<PaymentActionResult>, key: string, id: string) {
  return (prev: PaymentActionResult) => {
    const formData = new FormData();
    formData.set(key, id);
    return action(prev, formData);
  };
}

function ActionForm({ label, action, variant = "secondary", icon }: { label: string; action: (prev: PaymentActionResult) => Promise<PaymentActionResult>; variant?: "secondary" | "danger"; icon?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return <form action={formAction} className="inline-flex flex-col gap-1"><Button variant={variant} disabled={pending}>{icon}{label}</Button>{!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}</form>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p><div className="mt-1 text-sm">{value ?? "-"}</div></div>;
}

export function CustomerPaymentDetail({ payment, allocations }: { payment: CustomerPaymentRecord; allocations: CustomerPaymentAllocationRecord[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Paiement ${payment.payment_number}`}
        description={payment.customer_name ?? ""}
        actions={(
          <>
            <Link href={`/facturation/paiements/${payment.id}/print`} target="_blank"><Button type="button" variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button></Link>
            {payment.available_amount > 0 && payment.status !== "cancelled" ? <Link href={`/facturation/paiements/${payment.id}/affecter`}><Button type="button">Affecter a des factures</Button></Link> : null}
            {payment.allocated_amount <= 0 && payment.status !== "cancelled" ? <Link href={`/facturation/paiements/${payment.id}/edit`}><Button type="button" variant="secondary">Modifier</Button></Link> : null}
            {payment.status !== "cancelled" ? <ActionForm label="Annuler" variant="danger" icon={<XCircle className="h-4 w-4" />} action={actionWithId(cancelCustomerPayment, "id", payment.id)} /> : null}
          </>
        )}
      />
      <Card><CardContent className="flex flex-wrap items-center gap-3"><PaymentStatusBadge status={payment.status} /><span className="text-sm text-[var(--muted)]">Cree le {formatDate(payment.created_at)}</span></CardContent></Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Informations paiement</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Client" value={payment.customer_name} />
          <Info label="Date" value={formatDate(payment.payment_date)} />
          <Info label="Modalite" value={getPaymentMethodLabel(payment.payment_method) ?? payment.payment_method} />
          <Info label="Montant" value={<MoneyDisplay value={payment.amount} />} />
          <Info label="Affecte" value={<MoneyDisplay value={payment.allocated_amount} />} />
          <Info label="Disponible" value={<MoneyDisplay value={payment.available_amount} />} />
          <Info label="Reference" value={payment.reference ?? payment.transfer_reference ?? payment.check_number} />
          <Info label="Banque" value={payment.bank_name} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Affectations aux factures</h2></CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Facture</Th><Th>Date</Th><Th>Montant affecte</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={4} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">Aucune facture affectee.</td></tr>
              ) : allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <Td>{allocation.invoice_number}</Td><Td>{formatDate(allocation.allocation_date)}</Td><Td><MoneyDisplay value={allocation.amount} /></Td>
                  <Td><ActionForm label="Retirer" action={actionWithId(unallocatePaymentFromInvoice, "allocation_id", allocation.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      {payment.notes || payment.internal_notes ? <Card><CardHeader><h2 className="font-semibold">Notes</h2></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Info label="Notes" value={payment.notes} /><Info label="Notes internes" value={payment.internal_notes} /></CardContent></Card> : null}
    </div>
  );
}
