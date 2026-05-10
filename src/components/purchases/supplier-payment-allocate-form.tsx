"use client";

import { useActionState, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { allocateSupplierPaymentToInvoices } from "@/lib/purchase-actions";
import { formatDate } from "@/lib/format";
import type { SupplierInvoiceRecord, SupplierPaymentRecord } from "@/lib/purchase-types";

export function SupplierPaymentAllocateForm({
  payment,
  openInvoices,
}: {
  payment: SupplierPaymentRecord;
  openInvoices: SupplierInvoiceRecord[];
}) {
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState(allocateSupplierPaymentToInvoices, { success: true });

  const toggleInvoice = useCallback((invId: string, remainingAmount: number) => {
    setAllocations((prev) => {
      if (prev[invId]) {
        const next = { ...prev };
        delete next[invId];
        return next;
      }
      return { ...prev, [invId]: Math.min(remainingAmount, payment.available_amount) };
    });
  }, [payment.available_amount]);

  const updateAmount = useCallback((invId: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [invId]: Math.max(0, Math.min(value, payment.available_amount)) }));
  }, [payment.available_amount]);

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + v, 0);

  function handleSubmit(formData: FormData) {
    formData.set("id", payment.id);
    const allocs = Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, amt]) => ({ invoice_id: invoiceId, amount: amt }));
    formData.set("allocations", JSON.stringify(allocs));
    formAction(formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affecter paiement"
        description={`${payment.payment_number} - Disponible: ${payment.available_amount.toFixed(2)} MAD`}
      />

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><span className="text-xs font-medium uppercase text-[var(--muted)]">Montant</span><p className="mt-1"><MoneyDisplay value={payment.amount} /></p></div>
          <div><span className="text-xs font-medium uppercase text-[var(--muted)]">Deja affecte</span><p className="mt-1"><MoneyDisplay value={payment.allocated_amount} /></p></div>
          <div><span className="text-xs font-medium uppercase text-[var(--muted)]">Disponible</span><p className="mt-1"><MoneyDisplay value={payment.available_amount} /></p></div>
        </CardContent>
      </Card>

      <form action={handleSubmit}>
        <Card>
          <CardHeader><h2 className="font-semibold">Factures ouvertes</h2></CardHeader>
          <CardContent>
            {openInvoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Aucune facture ouverte pour ce fournisseur.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-[var(--muted)]">
                    <th className="pb-2 pr-2">Facture</th>
                    <th className="pb-2 pr-2">Date</th>
                    <th className="pb-2 pr-2 text-right">Total TTC</th>
                    <th className="pb-2 pr-2 text-right">Reste</th>
                    <th className="pb-2 pr-2">Affecter</th>
                    <th className="pb-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2 pr-2">{inv.invoice_number}</td>
                      <td className="py-2 pr-2">{formatDate(inv.invoice_date)}</td>
                      <td className="py-2 pr-2 text-right"><MoneyDisplay value={inv.total_ttc} /></td>
                      <td className="py-2 pr-2 text-right"><MoneyDisplay value={inv.remaining_amount} /></td>
                      <td className="py-2 pr-2">
                        <input type="checkbox" checked={!!allocations[inv.id]} onChange={() => toggleInvoice(inv.id, inv.remaining_amount)} />
                      </td>
                      <td className="py-2 text-right">
                        {allocations[inv.id] !== undefined ? (
                          <input type="number" step="0.01" value={allocations[inv.id]} onChange={(e) => updateAmount(inv.id, parseFloat(e.target.value) || 0)} className="w-24 rounded border border-input bg-background px-2 py-1 text-xs text-right" />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {totalAllocated > 0 ? (
              <p className="mt-2 text-sm">Total affectation : <MoneyDisplay value={totalAllocated} /></p>
            ) : null}
          </CardContent>
        </Card>

        {!state.success && state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={pending || totalAllocated <= 0}>
            Affecter
          </Button>
        </div>
      </form>
    </div>
  );
}
