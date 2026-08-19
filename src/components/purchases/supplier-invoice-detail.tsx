"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, CreditCard, ExternalLink, Pencil, Printer, Wallet, XCircle } from "lucide-react";
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
import { validateSupplierInvoice, cancelSupplierInvoice, recalculateSupplierInvoicePaymentStatusAction } from "@/lib/purchase-actions";
import { postSupplierInvoiceToAccounting } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";
import type {
  PurchaseActionResult,
  SupplierInvoiceLineRecord,
  SupplierInvoicePaymentAttachment,
  SupplierInvoicePaymentSummary,
  SupplierInvoiceRecord,
} from "@/lib/purchase-types";
import { SUPPLIER_PAYMENT_STATUS_LABELS, isSupplierInvoiceFromReceipt } from "@/lib/purchase-types";
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

const PAYMENT_STATUS_LABELS: Record<SupplierInvoicePaymentSummary["paymentStatus"], string> = {
  unpaid: "Non payée",
  partial: "Partiellement payée",
  paid: "Payée",
  overpaid: "Surpayée",
};

const PAYMENT_STATUS_REPAIR_LABEL = "Paiement à régulariser";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  check: "Chèque",
  transfer: "Virement bancaire",
  bank_transfer: "Virement bancaire",
  cash: "Espèces",
  card: "Carte bancaire",
  bank_card: "Carte bancaire",
  direct_debit: "Prélèvement",
  other: "Autre",
};

const PAYMENT_SOURCE_LABELS: Record<SupplierInvoicePaymentAttachment["source"], string> = {
  supplier_payments: "Paiement fournisseur",
  payments: "Paiement",
  payment_allocations: "Affectation",
  supplier_payment_allocations: "Affectation",
  treasury_transactions: "Trésorerie",
  possible_match: "Possible",
};

function paymentTone(status: SupplierInvoicePaymentSummary["paymentStatus"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "partial") return "warning";
  if (status === "overpaid") return "danger";
  return "neutral";
}

function paymentStatusBadge(summary: SupplierInvoicePaymentSummary | null) {
  const status = summary?.paymentStatus ?? "unpaid";
  if (summary?.hasPaymentInconsistency || summary?.isInconsistentWithStoredStatus) {
    return <Badge tone="warning">{PAYMENT_STATUS_REPAIR_LABEL}</Badge>;
  }
  return <Badge tone={paymentTone(status)}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

function displayDocumentStatus(invoice: SupplierInvoiceRecord, summary: SupplierInvoicePaymentSummary | null) {
  if ((summary?.hasPaymentInconsistency || summary?.isInconsistentWithStoredStatus) && ["paid", "partially_paid"].includes(invoice.status)) {
    return "validated";
  }
  if (["paid", "partially_paid"].includes(invoice.status)) return "validated";
  return invoice.status;
}

function SummaryTile({ label, value, helper }: { label: string; value: React.ReactNode; helper?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-xl font-semibold text-[var(--foreground)]">{value}</div>
      {helper ? <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}

function PaymentsSection({
  invoice,
  payments,
  summary,
}: {
  invoice: SupplierInvoiceRecord;
  payments: SupplierInvoicePaymentAttachment[];
  summary: SupplierInvoicePaymentSummary | null;
}) {
  const effectiveSummary = summary ?? {
    invoiceTotalTtc: Number(invoice.total_ttc ?? 0),
    paidAmount: Number(invoice.paid_amount ?? 0),
    remainingAmount: Number(invoice.remaining_amount ?? 0),
    overpaidAmount: 0,
    paymentStatus: invoice.payment_status === "paid" ? "paid" : invoice.payment_status === "partial" ? "partial" : "unpaid",
    confirmedPaidAmount: Number(invoice.paid_amount ?? 0),
    storedPaidAmount: Number(invoice.paid_amount ?? 0),
    storedRemainingAmount: Number(invoice.remaining_amount ?? 0),
    hasPaymentInconsistency: false,
    storedPaymentStatus: invoice.payment_status,
    isInconsistentWithStoredStatus: false,
  } satisfies SupplierInvoicePaymentSummary;
  const confirmedPayments = payments.filter((payment) => payment.matchStatus === "confirmed");
  const possiblePayments = payments.filter((payment) => payment.matchStatus === "possible_match");
  const canRegisterPayment = effectiveSummary.canRegisterPayment !== false && effectiveSummary.paymentStatus !== "paid" && invoice.status !== "cancelled";
  const paymentHref = `/achats/paiements/new?supplierId=${invoice.supplier_id}&invoiceId=${invoice.id}`;
  const renderPaymentRows = (rows: SupplierInvoicePaymentAttachment[]) =>
    rows.map((payment) => (
      <tr key={`${payment.source}-${payment.allocation_id}`}>
        <Td>{payment.payment_date ? formatDate(payment.payment_date) : "-"}</Td>
        <Td className="font-medium">
          {payment.source === "treasury_transactions" ? (
            <span>{payment.payment_number}</span>
          ) : (
            <Link href={`/achats/paiements/${payment.id}`} className="text-[var(--secondary)] hover:text-[var(--primary)] hover:underline">
              {payment.payment_number}
            </Link>
          )}
        </Td>
        <Td><Badge tone={payment.matchStatus === "confirmed" ? "success" : "warning"}>{PAYMENT_SOURCE_LABELS[payment.source]}</Badge></Td>
        <Td>{payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method : "-"}</Td>
        <Td>
          {payment.treasury_account_id ? (
            <Link href={`/tresorerie/comptes/${payment.treasury_account_id}`} className="font-medium text-[var(--secondary)] hover:text-[var(--primary)] hover:underline">
              {payment.treasury_account_name ?? payment.treasury_account_id}
            </Link>
          ) : "-"}
          {payment.treasury_account_type ? <p className="text-xs text-[var(--muted)]">{payment.treasury_account_type === "cash" ? "Caisse" : payment.treasury_account_type === "bank" ? "Banque" : payment.treasury_account_type}</p> : null}
        </Td>
        <Td>{payment.reference ?? "-"}</Td>
        <Td className="text-right font-medium"><MoneyDisplay value={payment.amount} /></Td>
        <Td>
          <Badge tone={payment.counted_in_paid_total ? "success" : payment.status === "cancelled" ? "danger" : "warning"}>
            {SUPPLIER_PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
          </Badge>
        </Td>
        <Td>
          {payment.accounting_entry_id ? (
            <Link href={`/comptabilite/ecritures/${payment.accounting_entry_id}`} className="font-medium text-[var(--secondary)] hover:text-[var(--primary)] hover:underline">
              {payment.accounting_entry_number || "Écriture"}
            </Link>
          ) : <span className="text-[var(--muted)]">Non</span>}
        </Td>
        <Td>
          <div className="flex flex-wrap gap-2">
            {payment.source !== "treasury_transactions" ? (
              <Link href={`/achats/paiements/${payment.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--secondary)] hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Paiement
              </Link>
            ) : null}
            {payment.treasury_transaction_id ? (
              <Link href={`/tresorerie/mouvements/${payment.treasury_transaction_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--secondary)] hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Trésorerie
              </Link>
            ) : null}
            {payment.accounting_entry_id ? (
              <Link href={`/comptabilite/ecritures/${payment.accounting_entry_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--secondary)] hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Écriture
              </Link>
            ) : null}
            {payment.matchStatus === "possible_match" ? <span className="text-xs text-[var(--muted)]">Score {payment.matchScore ?? "-"}</span> : null}
          </div>
        </Td>
      </tr>
    ));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Paiements attachés</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Liste des règlements associés à cette facture fournisseur.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paymentStatusBadge(effectiveSummary)}
            {canRegisterPayment ? (
              <Button asChild><Link href={paymentHref}><CreditCard className="h-4 w-4" /> Enregistrer un paiement</Link></Button>
            ) : (
              <Button variant="secondary" asChild><Link href={`/achats/paiements?supplierId=${invoice.supplier_id}`}><Wallet className="h-4 w-4" /> Voir les paiements</Link></Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Total facture" value={<MoneyDisplay value={effectiveSummary.invoiceTotalTtc} />} />
          <SummaryTile label="Total payé confirmé" value={<MoneyDisplay value={effectiveSummary.paidAmount} />} helper="Paiements affectés ou liés directement." />
          <SummaryTile label="Reste à payer" value={<MoneyDisplay value={Math.max(effectiveSummary.remainingAmount, 0)} />} />
          <SummaryTile label="Trop payé" value={<MoneyDisplay value={effectiveSummary.overpaidAmount} />} />
        </div>

        {effectiveSummary.paymentStatus === "overpaid" ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Cette facture présente un trop-payé de <MoneyDisplay value={effectiveSummary.overpaidAmount} />. Vérifiez les règlements attachés.
          </div>
        ) : null}

        {effectiveSummary.isInconsistentWithStoredStatus ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>Statut incohérent : cette facture est marquée payée ou partiellement payée en base, mais les règlements confirmés attachés indiquent un autre solde.</p>
              <p className="text-xs">Montant payé enregistré : <MoneyDisplay value={effectiveSummary.storedPaidAmount ?? 0} /> / montant confirmé : <MoneyDisplay value={effectiveSummary.confirmedPaidAmount ?? effectiveSummary.paidAmount} />.</p>
              <ActionForm label="Recalculer le statut de paiement" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(recalculateSupplierInvoicePaymentStatusAction, invoice.id)} />
            </div>
          </div>
        ) : null}

        {confirmedPayments.length === 0 ? (
          <EmptyState
            title="Aucun paiement attaché"
            description="Aucun paiement confirmé n’est attaché à cette facture fournisseur."
            action={canRegisterPayment ? <Button asChild><Link href={paymentHref}>Enregistrer un paiement</Link></Button> : undefined}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Numéro paiement</Th>
                <Th>Source</Th>
                <Th>Mode</Th>
                <Th>Compte / Caisse</Th>
                <Th>Référence</Th>
                <Th>Montant</Th>
                <Th>Statut</Th>
                <Th>Comptabilisé</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {renderPaymentRows(confirmedPayments)}
            </tbody>
          </Table>
        )}

        {possiblePayments.length > 0 ? (
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50/70 p-4">
            <div>
              <h3 className="font-semibold text-amber-950">Paiements potentiellement liés</h3>
              <p className="mt-1 text-sm text-amber-900">Ces lignes ressemblent à des paiements de cette facture, mais aucune liaison fiable n’existe encore. Paiement probable — liaison manuelle à prévoir.</p>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Numéro paiement</Th>
                  <Th>Source</Th>
                  <Th>Mode</Th>
                  <Th>Compte / Caisse</Th>
                  <Th>Référence</Th>
                  <Th>Montant</Th>
                  <Th>Statut</Th>
                  <Th>Comptabilisé</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>{renderPaymentRows(possiblePayments)}</tbody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SupplierInvoiceDetail({
  invoice,
  lines,
  payments = [],
  paymentSummary = null,
  accountingEntry,
  documentFlow,
}: {
  invoice: SupplierInvoiceRecord;
  lines: SupplierInvoiceLineRecord[];
  payments?: SupplierInvoicePaymentAttachment[];
  paymentSummary?: SupplierInvoicePaymentSummary | null;
  accountingEntry?: AccountingEntryInfo | null;
  documentFlow?: DocumentFlowStep[];
}) {
  const canEdit = invoice.status === "draft";
  const canValidate = invoice.status === "draft";
  const canPay = !["draft", "cancelled"].includes(invoice.status) && paymentSummary?.canRegisterPayment !== false;
  const topPaymentSummary = paymentSummary ?? null;
  const fromReceipt = isSupplierInvoiceFromReceipt(invoice, lines);
  const hasConfirmedPayment = Number(paymentSummary?.paidAmount ?? paymentSummary?.confirmedPaidAmount ?? 0) > 0.01;
  const hasAccountingEntry = Boolean(accountingEntry?.entry);
  const canCancel = invoice.status !== "cancelled" && !fromReceipt && !hasConfirmedPayment && !hasAccountingEntry;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Facture fournisseur ${invoice.invoice_number}`}
        description={invoice.supplier_name ?? ""}
        actions={
          <>
            {canEdit ? (
              <Button variant="secondary" asChild><Link href={`/achats/factures/${invoice.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
            ) : null}
            {canValidate ? (
              <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateSupplierInvoice, invoice.id)} />
            ) : null}
            {canPay ? (
              <Button asChild><Link href={`/achats/paiements/new?supplierId=${invoice.supplier_id}&invoiceId=${invoice.id}`}>Payer</Link></Button>
            ) : null}
            <Button variant="secondary" asChild><Link href={`/achats/factures/${invoice.id}/print`} target="_blank"><Printer className="h-4 w-4" /> Imprimer</Link></Button>
            {canCancel ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierInvoice, invoice.id)} />
            ) : null}
          </>
        }
      />

      <DocumentFlowMap steps={documentFlow ?? []} />

      {fromReceipt || hasConfirmedPayment || hasAccountingEntry ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm text-blue-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {fromReceipt
                    ? "Cette facture est issue d’une réception fournisseur."
                    : "Cette facture est déjà engagée dans le flux achat."}
                </p>
                <p className="mt-1 text-blue-900">
                  Les actions d’annulation ou d’archivage direct sont désactivées afin de préserver la traçabilité. Utilisez un avoir fournisseur ou une écriture de correction selon le cas.
                </p>
              </div>
            </div>
            {invoice.source_receipt_id ? (
              <Button type="button" variant="secondary" className="bg-white" asChild><Link href={`/achats/receptions/${invoice.source_receipt_id}`}>
                  Voir la réception source
                </Link></Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase text-[var(--muted)]">Statut document</span>
          <SupplierInvoiceStatusBadge status={displayDocumentStatus(invoice, topPaymentSummary)} />
          <span className="text-xs font-medium uppercase text-[var(--muted)]">Statut paiement</span>
          {paymentStatusBadge(topPaymentSummary)}
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
                    <Td>{line.unit_name ? line.unit_name : <Badge tone="warning">À compléter</Badge>}</Td>
                    <Td>{line.unit_price_ht > 0 ? <MoneyDisplay value={line.unit_price_ht} /> : <Badge tone="warning">À compléter</Badge>}</Td>
                    <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                    <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                    <Td>{line.tax_rate_id || line.tax_rate > 0 ? `${line.tax_rate}%` : <Badge tone="warning">À compléter</Badge>}</Td>
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
          <Info label="Montant payé confirmé" value={<MoneyDisplay value={paymentSummary?.confirmedPaidAmount ?? paymentSummary?.paidAmount ?? 0} />} />
          <Info label="Reste à payer calculé" value={<MoneyDisplay value={paymentSummary?.remainingAmount ?? invoice.total_ttc} />} />
        </CardContent>
      </Card>

      <PaymentsSection invoice={invoice} payments={payments} summary={paymentSummary} />

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
              <Button variant="secondary" className="h-8 px-3 text-xs" asChild><Link href={`/comptabilite/ecritures/${accountingEntry.entry.id}`}>Voir l&apos;ecriture</Link></Button>
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
