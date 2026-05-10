"use client";

import { useActionState, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { createSupplierReceipt } from "@/lib/purchase-actions";
import { DateField } from "@/components/ui/date-field";
import { formatNumber } from "@/lib/format";
import type { ReceivableSupplierOrder } from "@/lib/purchase-types";

export function SupplierReceiptForm({ order }: { order: ReceivableSupplierOrder }) {
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    order.lines.forEach((l) => { q[l.id] = Math.max(l.remaining_to_receive, 0); });
    return q;
  });

  const [state, formAction, pending] = useActionState(createSupplierReceipt, { success: true });

  const updateQty = useCallback((lineId: string, value: number) => {
    setQuantities((prev) => ({ ...prev, [lineId]: Math.max(0, value) }));
  }, []);

  function handleSubmit(formData: FormData) {
    formData.set("order_id", order.id);
    formData.set("receipt_date", receiptDate);
    if (notes) formData.set("notes", notes);

    const lines = order.lines.map((l) => ({
      source_line_id: l.id,
      product_id: l.product_id,
      product_name: l.product_name,
      description: l.description,
      quantity: quantities[l.id] ?? 0,
      unit_id: l.unit_id,
      unit_name: l.unit_name,
      ordered_quantity: l.ordered_quantity ?? l.quantity,
      received_quantity: l.received_quantity ?? 0,
    }));
    formData.set("lines", JSON.stringify(lines));
    formAction(formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nouvelle reception" description={`Commande : ${order.document_number} - ${order.supplier_name ?? ""}`} />

      <form action={handleSubmit}>
        <Card>
          <CardHeader><h2 className="font-semibold">Reception fournisseur</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DateField label="Date reception" value={receiptDate} onChange={setReceiptDate} />
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><h2 className="font-semibold">Lignes a receptionner</h2></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Article</Th><Th>Description</Th><Th>Unite</Th><Th>Commande</Th><Th>Deja recu</Th><Th>Reste</Th><Th>A recevoir</Th></tr></thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <Td>{line.product_name || "Ligne libre"}</Td>
                    <Td>{line.description}</Td>
                    <Td>{line.unit_name ?? "-"}</Td>
                    <Td>{formatNumber(line.ordered_quantity ?? line.quantity)}</Td>
                    <Td>{formatNumber(line.received_quantity)}</Td>
                    <Td>{formatNumber(line.remaining_to_receive)}</Td>
                    <Td>
                      <input
                        type="number"
                        step={line.unit_name?.toLowerCase() === "u" ? "1" : "0.001"}
                        min="0"
                        max={line.remaining_to_receive}
                        value={quantities[line.id] ?? 0}
                        onChange={(e) => updateQty(line.id, parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        {!state.success && state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={pending}>
            Creer reception
          </Button>
        </div>
      </form>
    </div>
  );
}
