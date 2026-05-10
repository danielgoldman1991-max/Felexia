"use client";

import Link from "next/link";
import { useActionState } from "react";
import { XCircle, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { formatDate } from "@/lib/format";
import { cancelSupplierPayment } from "@/lib/purchase-actions";
import type { PurchaseActionResult, SupplierPaymentAllocationRecord, SupplierPaymentRecord } from "@/lib/purchase-types";
import { SUPPLIER_PAYMENT_STATUS_LABELS, SUPPLIER_PAYMENT_TYPE_LABELS } from "@/lib/purchase-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p><div className="mt-1 text-sm">{value ?? "-"}</div></div>;
}

function actionWithId(action: (prev: PurchaseActionResult, formData: FormData) => Promise<PurchaseActionResult>, id: string) {
  return (prev: PurchaseActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function ActionForm({ label, icon, action, variant = "secondary" }: { label: string; icon?: React.ReactNode; action: (prev: PurchaseActionResult) => Promise<PurchaseActionResult>; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <Button variant={variant} disabled={pending}>{icon}{label}</Button>
      {!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function SupplierPaymentDetail({
  payment,
  allocations,
}: {
  payment: SupplierPaymentRecord;
  allocations: SupplierPaymentAllocationRecord[];
}) {
  const canAllocate = payment.available_amount > 0;
  const canCancel = payment.status !== "cancelled";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Paiement ${payment.payment_number}`}
        description={payment.supplier_name ?? ""}
        actions={
          <>
            {canAllocate ? (
              <Link href={`/achats/paiements/${payment.id}/affecter`}>
                <Button variant="secondary"><ArrowLeftRight className="h-4 w-4" /> Affecter</Button>
              </Link>
            ) : null}
            {canCancel ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierPayment, payment.id)} />
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{SUPPLIER_PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</span>
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(payment.created_at)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
          <CardContent className="grid gap-3">
            <Info label="Fournisseur" value={payment.supplier_name} />
            <Info label="Date paiement" value={formatDate(payment.payment_date)} />
            <Info label="Mode de paiement" value={payment.payment_method ?? "-"} />
            <Info label="Reference" value={payment.reference ?? "-"} />
            <Info label="Type" value={SUPPLIER_PAYMENT_TYPE_LABELS[payment.payment_type] ?? payment.payment_type} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Montants</h2></CardHeader>
          <CardContent className="grid gap-3">
            <Info label="Montant" value={<MoneyDisplay value={payment.amount} />} />
            <Info label="Montant affecte" value={<MoneyDisplay value={payment.allocated_amount} />} />
            <Info label="Disponible" value={<MoneyDisplay value={payment.available_amount} />} />
          </CardContent>
        </Card>
      </div>

      {allocations.length > 0 ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Affectations</h2></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-[var(--muted)]">
                  <th className="pb-2 pr-2">Facture</th>
                  <th className="pb-2 pr-2 text-right">Total TTC</th>
                  <th className="pb-2 text-right">Montant paye</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => (
                  <tr key={alloc.id} className="border-b">
                    <td className="py-2 pr-2">
                      <Link href={`/achats/factures/${alloc.invoice_id}`} className="font-medium text-[var(--secondary)] hover:text-[var(--primary)]">
                        {alloc.invoice_number ?? alloc.invoice_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-right"><MoneyDisplay value={alloc.invoice_total_ttc ?? 0} /></td>
                    <td className="py-2 text-right"><MoneyDisplay value={alloc.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {payment.notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent><p className="text-sm">{payment.notes}</p></CardContent>
        </Card>
      ) : null}
    </div>
  );
}
