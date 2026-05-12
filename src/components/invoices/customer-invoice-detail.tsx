"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Bell, BookOpenCheck, CheckCircle2, Printer, RotateCcw, Send, WalletCards, XCircle } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { InvoicePaymentStatusBadge, InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { cancelCustomerInvoice, markInvoiceAsSent, validateCustomerInvoice } from "@/lib/invoice-actions";
import { postCustomerInvoiceToAccounting } from "@/lib/accounting-actions";
import { getPaymentTermLabel, getPaymentMethodLabel } from "@/lib/payment-terms";
import { hasDiscount } from "@/lib/sales-types";
import type { CustomerInvoiceLineRecord, CustomerInvoiceRecord, InvoiceActionResult } from "@/lib/invoice-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import { formatDate } from "@/lib/format";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p><div className="mt-1 text-sm">{value ?? "-"}</div></div>;
}

function actionWithId(action: (prev: InvoiceActionResult, formData: FormData) => Promise<InvoiceActionResult>, id: string) {
  return (prev: InvoiceActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function accountingActionWithInvoiceId(action: (prev: InvoiceActionResult, formData: FormData) => Promise<InvoiceActionResult>, invoiceId: string) {
  return (prev: InvoiceActionResult) => {
    const formData = new FormData();
    formData.set("invoice_id", invoiceId);
    return action(prev, formData);
  };
}

function ActionForm({ label, action, icon, variant = "secondary" }: { label: string; action: (prev: InvoiceActionResult) => Promise<InvoiceActionResult>; icon?: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return <form action={formAction} className="inline-flex flex-col gap-1"><Button variant={variant} disabled={pending}>{icon}{label}</Button>{!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}</form>;
}

type AccountingEntryInfo = {
  entry: Record<string, unknown> | null;
  lines: Array<Record<string, unknown>>;
};

export function CustomerInvoiceDetail({ invoice, lines, accountingEntry, documentFlow }: { invoice: CustomerInvoiceRecord; lines: CustomerInvoiceLineRecord[]; accountingEntry?: AccountingEntryInfo | null; documentFlow?: DocumentFlowStep[] }) {
  const discountPresent = hasDiscount(lines);
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Facture ${invoice.invoice_number}`}
        description={invoice.customer_name ?? ""}
        actions={(
          <>
            <Link href={`/facturation/factures/${invoice.id}/print`} target="_blank"><Button type="button" variant="secondary"><Printer className="h-4 w-4" /> Imprimer / PDF</Button></Link>
            {!["draft", "cancelled", "paid"].includes(invoice.status) && invoice.remaining_amount > 0 ? (
              <Link href={`/facturation/factures/${invoice.id}/paiement`}><Button type="button" variant="secondary"><WalletCards className="h-4 w-4" /> Enregistrer paiement</Button></Link>
            ) : null}
            {["validated", "sent", "partially_paid", "paid"].includes(invoice.status) ? (
              <Link href={`/facturation/avoirs/new?invoiceId=${invoice.id}`}><Button type="button" variant="secondary"><RotateCcw className="h-4 w-4" /> Creer avoir</Button></Link>
            ) : null}
            {invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.remaining_amount > 0 && !["draft", "cancelled"].includes(invoice.status) ? (
              <Link href={`/facturation/relances/new?customerId=${invoice.customer_id}`}><Button type="button" variant="secondary"><Bell className="h-4 w-4" /> Creer relance</Button></Link>
            ) : null}
            {invoice.status === "draft" ? (
              <>
                <Link href={`/facturation/factures/${invoice.id}/edit`}><Button type="button" variant="secondary">Modifier</Button></Link>
                <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateCustomerInvoice, invoice.id)} />
                <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelCustomerInvoice, invoice.id)} />
              </>
            ) : null}
            {invoice.status === "validated" ? <ActionForm label="Marquer envoyee" icon={<Send className="h-4 w-4" />} action={actionWithId(markInvoiceAsSent, invoice.id)} /> : null}
          </>
        )}
      />
      <DocumentFlowMap steps={documentFlow ?? []} />
      <Card><CardContent className="flex flex-wrap items-center gap-3"><InvoiceStatusBadge status={invoice.status} /><InvoicePaymentStatusBadge status={invoice.payment_status} /><span className="text-sm text-[var(--muted)]">Cree le {formatDate(invoice.created_at)}</span></CardContent></Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Informations facture</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Client" value={invoice.customer_name} />
          <Info label="Date facture" value={formatDate(invoice.invoice_date)} />
          <Info label="Echeance" value={invoice.due_date ? formatDate(invoice.due_date) : null} />
          <Info label="Source" value={invoice.source_order_number ?? invoice.source_delivery_number ?? invoice.source_document_number ?? invoice.source_type ?? "manual"} />
          {invoice.payment_terms || invoice.payment_method ? (
            <>
              <Info label="Conditions de paiement" value={getPaymentTermLabel(invoice.payment_terms) || (invoice.payment_terms_days ? `${invoice.payment_terms_days} jours` : null)} />
              <Info label="Modalites de paiement" value={getPaymentMethodLabel(invoice.payment_method)} />
            </>
          ) : null}
          {invoice.custom_payment_terms ? <Info label="Detail condition" value={invoice.custom_payment_terms} /> : null}
          {invoice.custom_payment_method ? <Info label="Detail modalite" value={invoice.custom_payment_method} /> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? <EmptyState title="Aucune ligne" description="Cette facture ne contient aucune ligne." /> : (
            <Table>
              <thead><tr><Th>#</Th><Th>Produit</Th><Th>Description</Th><Th>Quantite</Th><Th>Unite</Th><Th>Prix HT</Th>{discountPresent ? <Th>Remise</Th> : null}<Th>Total HT</Th><Th>TVA</Th><Th>Total TTC</Th></tr></thead>
              <tbody>{lines.map((line, index) => <tr key={line.id}><Td>{index + 1}</Td><Td>{line.product_name || "Ligne libre"}</Td><Td>{line.description}</Td><Td>{line.quantity}</Td><Td>{line.unit_name ?? "-"}</Td><Td><MoneyDisplay value={line.unit_price_ht} /></Td>{discountPresent ? <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td> : null}<Td><MoneyDisplay value={line.subtotal_ht} /></Td><Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td><Td><MoneyDisplay value={line.total_ttc} /></Td></tr>)}</tbody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Totaux</h2></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Info label="Total HT" value={<MoneyDisplay value={invoice.subtotal_ht} />} />
          {discountPresent ? <Info label="Remise" value={<MoneyDisplay value={invoice.discount_total} />} /> : null}
          <Info label="TVA" value={<MoneyDisplay value={invoice.tax_total} />} />
          <Info label="Total TTC" value={<span className="font-semibold"><MoneyDisplay value={invoice.total_ttc} /></span>} />
          <Info label="Avoirs affectes" value={<MoneyDisplay value={invoice.credit_amount} />} />
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
            <p className="text-sm text-[var(--muted)]">L&apos;ecriture comptable pourra etre generee apres validation de la facture.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">Aucune ecriture comptable generee pour cette facture.</p>
              <ActionForm label="Comptabiliser" icon={<BookOpenCheck className="h-4 w-4" />} action={accountingActionWithInvoiceId(postCustomerInvoiceToAccounting, invoice.id)} />
            </div>
          )}
        </CardContent>
      </Card>
      {invoice.notes || invoice.internal_notes ? <Card><CardHeader><h2 className="font-semibold">Notes</h2></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Info label="Notes client" value={invoice.notes} /><Info label="Notes internes" value={invoice.internal_notes} /></CardContent></Card> : null}
    </div>
  );
}
