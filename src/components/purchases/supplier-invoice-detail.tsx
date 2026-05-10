"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Pencil, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { SupplierInvoiceStatusBadge } from "@/components/purchases/supplier-invoice-status-badge";
import { validateSupplierInvoice, cancelSupplierInvoice } from "@/lib/purchase-actions";
import type { PurchaseActionResult, SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";

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

export function SupplierInvoiceDetail({ invoice, lines }: { invoice: SupplierInvoiceRecord; lines: SupplierInvoiceLineRecord[] }) {
  const canEdit = invoice.status === "draft";
  const canValidate = invoice.status === "draft";
  const canPay = ["validated", "partially_paid"].includes(invoice.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Facture fournisseur ${invoice.invoice_number}`}
        description={invoice.supplier_name ?? ""}
        actions={
          <>
            {canEdit ? (
              <Link href={`/achats/factures/${invoice.id}/edit`}>
                <Button variant="secondary"><Pencil className="h-4 w-4" /> Modifier</Button>
              </Link>
            ) : null}
            {canValidate ? (
              <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateSupplierInvoice, invoice.id)} />
            ) : null}
            {canPay ? (
              <Link href={`/achats/paiements/new?supplierId=${invoice.supplier_id}&invoiceId=${invoice.id}`}>
                <Button>Payer</Button>
              </Link>
            ) : null}
            <Link href={`/achats/factures/${invoice.id}/print`} target="_blank">
              <Button variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button>
            </Link>
            {invoice.status !== "cancelled" ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierInvoice, invoice.id)} />
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <SupplierInvoiceStatusBadge status={invoice.status} />
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(invoice.created_at)}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Fournisseur" value={invoice.supplier_name} />
          <Info label="Date facture" value={formatDate(invoice.invoice_date)} />
          <Info label="Echeance" value={invoice.due_date ? formatDate(invoice.due_date) : null} />
          <Info label="N Facture fournisseur" value={invoice.supplier_invoice_number ?? "-"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? <EmptyState title="Aucune ligne" description="Cette facture ne contient aucune ligne." /> : (
            <Table>
              <thead><tr><Th>#</Th><Th>Produit</Th><Th>Description</Th><Th>Quantite</Th><Th>Unite</Th><Th>Prix HT</Th><Th>Remise</Th><Th>Total HT</Th><Th>TVA</Th><Th>Total TTC</Th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <Td>{index + 1}</Td>
                    <Td>{line.product_name || "Ligne libre"}</Td>
                    <Td>{line.description}</Td>
                    <Td>{line.quantity}</Td>
                    <Td>{line.unit_name ?? "-"}</Td>
                    <Td><MoneyDisplay value={line.unit_price_ht} /></Td>
                    <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                    <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                    <Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td>
                    <Td><MoneyDisplay value={line.total_ttc} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Totaux</h2></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Info label="Total HT" value={<MoneyDisplay value={invoice.subtotal_ht} />} />
          <Info label="Total TVA" value={<MoneyDisplay value={invoice.tax_total} />} />
          <Info label="Total TTC" value={<span className="font-semibold"><MoneyDisplay value={invoice.total_ttc} /></span>} />
          <Info label="Montant paye" value={<MoneyDisplay value={invoice.paid_amount} />} />
          <Info label="Reste a payer" value={<MoneyDisplay value={invoice.remaining_amount} />} />
        </CardContent>
      </Card>

      {invoice.notes || invoice.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Notes" value={invoice.notes} />
            <Info label="Notes internes" value={invoice.internal_notes} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
