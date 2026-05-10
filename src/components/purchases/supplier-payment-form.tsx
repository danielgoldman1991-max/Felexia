"use client";

import { useActionState, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { SupplierCombobox } from "@/components/purchases/supplier-combobox";
import { DateField } from "@/components/ui/date-field";
import { createSupplierPayment } from "@/lib/purchase-actions";
import type { SupplierInvoiceRecord } from "@/lib/purchase-types";
import { formatDate } from "@/lib/format";

export function SupplierPaymentForm({
  suppliers,
  openInvoices,
  preselectedSupplierId,
  preselectedInvoiceId,
}: {
  suppliers: { id: string; name: string; ice: string | null }[];
  openInvoices: SupplierInvoiceRecord[];
  preselectedSupplierId?: string;
  preselectedInvoiceId?: string;
}) {
  const [supplierId, setSupplierId] = useState(preselectedSupplierId ?? "");
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [valueDate, setValueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const filteredInvoices = useMemo(() => openInvoices.filter((inv) => inv.supplier_id === supplierId), [openInvoices, supplierId]);

  const initialAlloc = (() => {
    if (preselectedInvoiceId && filteredInvoices.length > 0) {
      const inv = filteredInvoices.find((i) => i.id === preselectedInvoiceId);
      if (inv) {
        setAmount(inv.remaining_amount);
        return { [inv.id]: inv.remaining_amount };
      }
    }
    return {};
  })();

  const [allocations, setAllocations] = useState<Record<string, number>>(initialAlloc);

  const [state, formAction, pending] = useActionState(createSupplierPayment, { success: true });

  const toggleInvoice = useCallback((invId: string, invAmount: number) => {
    setAllocations((prev) => {
      if (prev[invId]) {
        const next = { ...prev };
        delete next[invId];
        return next;
      }
      return { ...prev, [invId]: invAmount };
    });
  }, [setAllocations]);

  const updateAllocAmount = useCallback((invId: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [invId]: Math.max(0, value) }));
  }, [setAllocations]);

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + v, 0);

  function handleSubmit(formData: FormData) {
    formData.set("supplier_id", supplierId);
    formData.set("amount", String(amount));
    formData.set("payment_date", paymentDate);
    if (valueDate) formData.set("value_date", valueDate);
    if (paymentMethod) formData.set("payment_method", paymentMethod);
    if (reference) formData.set("reference", reference);
    if (bankName) formData.set("bank_name", bankName);
    if (checkNumber) formData.set("check_number", checkNumber);
    if (transferReference) formData.set("transfer_reference", transferReference);
    if (dueDate) formData.set("due_date", dueDate);
    if (notes) formData.set("notes", notes);
    const allocs = Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, amt]) => ({ invoice_id: invoiceId, amount: amt }));
    formData.set("allocations", JSON.stringify(allocs));
    formAction(formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nouveau paiement fournisseur" description="Creer un paiement fournisseur" />

      <form action={handleSubmit}>
        <Card>
          <CardHeader><h2 className="font-semibold">Paiement</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Fournisseur</label>
              <SupplierCombobox suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Montant</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <DateField label="Date paiement" value={paymentDate} onChange={setPaymentDate} />
            <DateField label="Date valeur" value={valueDate} onChange={setValueDate} placeholder="jj/mm/aaaa" />
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Mode de paiement</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Selectionner...</option>
                <option value="check">Cheque</option>
                <option value="transfer">Virement</option>
                <option value="cash">Especes</option>
                <option value="bank_card">Carte bancaire</option>
                <option value="direct_debit">Prelevement</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Banque</label>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">N Cheque</label>
              <input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Ref virement</label>
              <input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <DateField label="Echeance" value={dueDate} onChange={setDueDate} placeholder="jj/mm/aaaa" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </CardContent>
        </Card>

        {supplierId && filteredInvoices.length > 0 ? (
          <Card className="mt-6">
            <CardHeader><h2 className="font-semibold">Affectation aux factures</h2></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-[var(--muted)]">
                    <th className="pb-2 pr-2">Facture</th>
                    <th className="pb-2 pr-2">Date</th>
                    <th className="pb-2 pr-2 text-right">Total</th>
                    <th className="pb-2 pr-2 text-right">Reste</th>
                    <th className="pb-2 pr-2">Affecter</th>
                    <th className="pb-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
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
                          <input type="number" step="0.01" value={allocations[inv.id]} onChange={(e) => updateAllocAmount(inv.id, parseFloat(e.target.value) || 0)} className="w-24 rounded border border-input bg-background px-2 py-1 text-xs text-right" />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalAllocated > 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Total affecte : <MoneyDisplay value={totalAllocated} /></p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!state.success && state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={pending || !supplierId || amount <= 0}>
            Creer paiement fournisseur
          </Button>
        </div>
      </form>
    </div>
  );
}
