"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BookOpenCheck, CheckCircle2, Pencil, Printer, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate } from "@/lib/format";
import { SupplierInvoiceStatusBadge } from "@/components/purchases/supplier-invoice-status-badge";
import { validateSupplierInvoice, cancelSupplierInvoice } from "@/lib/purchase-actions";
import { postSupplierInvoiceToAccounting } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";
import type { PurchaseActionResult, SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";

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

function ComptabiliserForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<AccountingActionResult, FormData>(postSupplierInvoiceToAccounting, { success: true });
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="supplier_invoice_id" value={invoiceId} />
      <Button variant="secondary" disabled={pending}><BookOpenCheck className="h-4 w-4" /> Comptabiliser</Button>
      {!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

type AccountingEntryInfo = {
  entry: Record<string, unknown> | null;
  lines: Array<Record<string, unknown>>;
};

export function SupplierInvoiceDetail({ invoice, lines, accountingEntry, documentFlow }: { invoice: SupplierInvoiceRecord; lines: SupplierInvoiceLineRecord[]; accountingEntry?: AccountingEntryInfo | null; documentFlow?: DocumentFlowStep[] }) {
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

      <DocumentFlowMap steps={documentFlow ?? []} />

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
          <Info label="N Facture fournisseur" value={invoice.supplier_invoice_number ?? <span className="text-amber-600">Non renseigne</span>} />
        </CardContent>
        {invoice.status === "draft" && !invoice.supplier_invoice_number ? (
          <CardContent className="border-t border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">Le numéro de facture fournisseur doit être renseigne avant validation.</p>
          </CardContent>
        ) : null}
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

      <Card>
        <CardHeader><h2 className="font-semibold">Comptabilite</h2></CardHeader>
        <CardContent>
          {accountingEntry?.entry ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    Ecriture <Link href={`/comptabilite/ecritures/${accountingEntry.entry.id}`} className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline">{String(accountingEntry.entry.entry_number ?? "")}</Link>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Journal: {String(accountingEntry.entry.journal_code ?? "-")} | {formatDate(String(accountingEntry.entry.entry_date ?? ""))}
                  </p>
                </div>
                <Badge tone={(accountingEntry.entry.status as string) === "posted" ? "success" : "neutral"}>
                  {String(accountingEntry.entry.status ?? "") === "posted" ? "Comptabilisee" : String(accountingEntry.entry.status ?? "")}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-[var(--muted)]">Total debit: <strong className="text-[var(--foreground)]"><MoneyDisplay value={Number(accountingEntry.entry.total_debit ?? 0)} /></strong></span>
                <span className="text-[var(--muted)]">Total credit: <strong className="text-[var(--foreground)]"><MoneyDisplay value={Number(accountingEntry.entry.total_credit ?? 0)} /></strong></span>
              </div>
              <Link href={`/comptabilite/ecritures/${accountingEntry.entry.id}`}>
                <Button variant="secondary" className="h-8 px-3 text-xs">Voir l&apos;ecriture</Button>
              </Link>
            </div>
          ) : invoice.status === "draft" || invoice.status === "cancelled" ? (
            <p className="text-sm text-[var(--muted)]">Validez d&apos;abord la facture fournisseur avant de la comptabiliser.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">Aucune ecriture comptable generee pour cette facture.</p>
              <ComptabiliserForm invoiceId={invoice.id} />
            </div>
          )}
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
