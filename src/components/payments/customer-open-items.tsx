"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import type { CustomerOpenItems } from "@/lib/payment-types";

type Props = {
  openItems: CustomerOpenItems | null;
  paymentAmount: number;
  allocations: Record<string, number>;
  loading?: boolean;
  error?: string | null;
  onAllocationsChange: (allocations: Record<string, number>) => void;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    validated: "Validee",
    sent: "Envoyee",
    partially_paid: "Partiellement payee",
    overdue: "En retard",
  };
  return labels[status] ?? status;
}

export function CustomerOpenItems({ openItems, paymentAmount, allocations, loading = false, error = null, onAllocationsChange }: Props) {
  const invoices = openItems?.invoices ?? [];
  const selectedRows = Object.entries(allocations)
    .map(([invoice_id, amount]) => ({ invoice_id, amount: Number(amount || 0) }))
    .filter((row) => row.amount > 0);
  const allocatedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
  const availableAfterAllocation = paymentAmount - allocatedTotal;
  const allocationStatus =
    allocatedTotal <= 0
      ? "Paiement non affecte"
      : availableAfterAllocation > 0
        ? "Paiement partiellement affecte"
        : "Paiement totalement affecte";

  function toggleInvoice(invoiceId: string, checked: boolean) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    const next = { ...allocations };
    if (!checked) {
      delete next[invoiceId];
      onAllocationsChange(next);
      return;
    }
    const currentAllocated = Object.entries(next)
      .filter(([id]) => id !== invoiceId)
      .reduce((sum, [, amount]) => sum + Number(amount || 0), 0);
    const remainingPayment = paymentAmount > 0 ? Math.max(paymentAmount - currentAllocated, 0) : invoice.remaining_amount;
    next[invoiceId] = Math.min(invoice.remaining_amount, remainingPayment || invoice.remaining_amount);
    onAllocationsChange(next);
  }

  function updateAllocation(invoiceId: string, value: number) {
    const next = { ...allocations };
    if (value <= 0) delete next[invoiceId];
    else next[invoiceId] = value;
    onAllocationsChange(next);
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="font-semibold">Echeances du client</h2>
          <p className="text-sm text-[var(--muted)]">
            Selectionnez les factures a regler, ou laissez vide pour creer un paiement non affecte.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-[var(--muted)]">Chargement des echeances...</p> : null}
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {!loading && invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[#f8fafc] p-4 text-sm text-[var(--muted)]">
            Aucune echeance ouverte pour ce client. Vous pouvez creer un paiement non affecte, il restera disponible pour une affectation ulterieure.
          </div>
        ) : null}
        {invoices.length > 0 ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">Factures ouvertes</p>
                <p className="text-lg font-semibold">{openItems?.summary.invoices_count ?? invoices.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">Reste total</p>
                <p className="text-lg font-semibold"><MoneyDisplay value={openItems?.summary.total_remaining_amount ?? 0} /></p>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">En retard</p>
                <p className="text-lg font-semibold"><MoneyDisplay value={openItems?.summary.overdue_amount ?? 0} /></p>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)]">Affecte maintenant</p>
                <p className="text-lg font-semibold"><MoneyDisplay value={allocatedTotal} /></p>
              </div>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Selection</Th>
                  <Th>Facture</Th>
                  <Th>Date</Th>
                  <Th>Echeance</Th>
                  <Th>Statut</Th>
                  <Th>Total TTC</Th>
                  <Th>Paye</Th>
                  <Th>Reste</Th>
                  <Th>Montant a affecter</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const checked = Number(allocations[invoice.id] ?? 0) > 0;
                  const allocation = Number(allocations[invoice.id] ?? 0);
                  const invalidAllocation = allocation > invoice.remaining_amount;
                  return (
                    <tr key={invoice.id}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleInvoice(invoice.id, event.target.checked)}
                          aria-label={`Selectionner ${invoice.invoice_number}`}
                        />
                      </Td>
                      <Td>
                        <div className="font-medium">{invoice.invoice_number}</div>
                        {invoice.is_overdue ? <Badge tone="danger">En retard</Badge> : null}
                      </Td>
                      <Td>{formatDate(invoice.invoice_date)}</Td>
                      <Td>{formatDate(invoice.due_date)}</Td>
                      <Td><Badge tone={invoice.status === "overdue" ? "danger" : "neutral"}>{statusLabel(invoice.status)}</Badge></Td>
                      <Td><MoneyDisplay value={invoice.total_ttc} /></Td>
                      <Td><MoneyDisplay value={invoice.paid_amount} /></Td>
                      <Td><MoneyDisplay value={invoice.remaining_amount} /></Td>
                      <Td>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            min="0"
                            max={invoice.remaining_amount}
                            step="0.01"
                            value={allocation}
                            onChange={(event) => updateAllocation(invoice.id, Number(event.target.value || 0))}
                          />
                          {invalidAllocation ? <p className="text-xs text-red-600">Depasse le reste a payer.</p> : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[#f8fafc] p-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>Montant du paiement : <strong><MoneyDisplay value={paymentAmount} /></strong></span>
            <span>Montant affecte : <strong><MoneyDisplay value={allocatedTotal} /></strong></span>
            <span>Solde disponible : <strong><MoneyDisplay value={Math.max(availableAfterAllocation, 0)} /></strong></span>
          </div>
          <Badge tone={allocatedTotal <= 0 ? "neutral" : availableAfterAllocation > 0 ? "warning" : "success"}>{allocationStatus}</Badge>
        </div>
        {allocatedTotal > paymentAmount ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Le montant affecte depasse le montant du paiement.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
