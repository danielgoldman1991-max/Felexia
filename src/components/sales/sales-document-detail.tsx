"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Archive, CheckCircle2, Pencil, Printer, Receipt, Send, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { SalesStatusBadge } from "@/components/sales/sales-status-badge";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate, formatNumber } from "@/lib/format";
import { getPaymentTermLabel, getPaymentMethodLabel } from "@/lib/payment-terms";
import {
  acceptQuote,
  archiveSalesDocument,
  confirmOrder,
  convertQuoteToOrder,
  markDeliveryAsDelivered,
  markQuoteAsSent,
  rejectQuote,
  validateDeliveryNote,
  validateReturnNote,
} from "@/lib/sales-actions";
import type { SalesActionResult, SalesDocumentLineRecord, SalesDocumentRecord } from "@/lib/sales-types";
import { hasDiscount, SALES_DOCUMENT_LABELS } from "@/lib/sales-types";
import type { CustomerCreditNoteRecord } from "@/lib/credit-note-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import type { OrderBillingGuard } from "@/lib/invoice-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

function recipientTypeLabel(document: SalesDocumentRecord) {
  const types = document.customer_types ?? [];
  const isProspect = types.includes("prospect");
  const isCustomer = types.includes("customer");

  if (isProspect && isCustomer) return "Client + Prospect";
  if (isProspect) return "Prospect";
  if (isCustomer) return "Client";
  return document.customer_primary_type === "prospect" ? "Prospect" : "Client";
}

function actionWithId(action: (prev: SalesActionResult, formData: FormData) => Promise<SalesActionResult>, id: string) {
  return (prev: SalesActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function deliveryOrderedQuantity(line: SalesDocumentLineRecord) {
  return line.ordered_quantity ?? null;
}

function deliveryRemainingQuantity(line: SalesDocumentLineRecord) {
  return line.remaining_quantity ?? null;
}

function deliveryAlreadyDeliveredBefore(line: SalesDocumentLineRecord) {
  const ordered = deliveryOrderedQuantity(line);
  const remaining = deliveryRemainingQuantity(line);
  if (ordered === null || remaining === null) return null;
  return Math.max(ordered - remaining - line.quantity, 0);
}

function DeliveryProgressBadge({ remaining }: { remaining: number | null }) {
  if (remaining === null) return <Badge tone="neutral">Reliquat non disponible</Badge>;
  return remaining <= 0 ? (
    <Badge tone="success">Livre totalement</Badge>
  ) : (
    <Badge tone="warning">Reste a livrer : {formatNumber(remaining)}</Badge>
  );
}

function ActionForm({
  label,
  icon,
  action,
  variant = "secondary",
}: {
  label: string;
  icon?: React.ReactNode;
  action: (prev: SalesActionResult) => Promise<SalesActionResult>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <Button variant={variant} disabled={pending}>{icon}{label}</Button>
      {!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function SalesDocumentDetail({
  document,
  lines,
  returnCreditNote,
  documentFlow,
  billingGuard,
}: {
  document: SalesDocumentRecord;
  lines: SalesDocumentLineRecord[];
  returnCreditNote?: CustomerCreditNoteRecord | null;
  documentFlow?: DocumentFlowStep[];
  billingGuard?: OrderBillingGuard | null;
}) {
  const isQuote = document.document_type === "quote";
  const isOrder = document.document_type === "order";
  const isDelivery = document.document_type === "delivery_note";
  const isReturn = document.document_type === "return_note";
  const isLogisticsDocument = isDelivery || isReturn;
  const discountPresent = !isLogisticsDocument && hasDiscount(lines);
  const title = `${SALES_DOCUMENT_LABELS[document.document_type]} ${document.document_number}`;
  const recipientLabel = recipientTypeLabel(document);
  const directInvoice = billingGuard?.directInvoice ?? null;
  const deliveryInvoices = billingGuard?.deliveryInvoices ?? [];
  const currentDeliveryInvoice = isDelivery
    ? deliveryInvoices.find((invoice) => invoice.delivery_id === document.id) ?? null
    : null;
  const firstDeliveryInvoice = currentDeliveryInvoice ?? deliveryInvoices[0] ?? null;
  const hasBillingConflict = Boolean(directInvoice && deliveryInvoices.length > 0) || deliveryInvoices.length > 1;
  const deliveryBillingBlocked = isDelivery && Boolean(directInvoice || currentDeliveryInvoice);
  const showBillingWarning = Boolean(
    billingGuard?.isBlocked && (!isDelivery || directInvoice || currentDeliveryInvoice || hasBillingConflict),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={document.customer_name ?? ""}
        actions={
          <>
            {isQuote ? (
              <Button type="button" variant="secondary" asChild><Link href={`/vente/devis/${document.id}/print`} target="_blank">
                  <Printer className="h-4 w-4" />
                  Imprimer / PDF
                </Link></Button>
            ) : null}
            {isOrder ? (
              <Button type="button" variant="secondary" asChild><Link href={`/vente/commandes/${document.id}/print`} target="_blank">
                  <Printer className="h-4 w-4" />
                  Imprimer / PDF
                </Link></Button>
            ) : null}
            {isDelivery ? (
              <Button type="button" variant="secondary" asChild><Link href={`/vente/livraisons/${document.id}/print`} target="_blank">
                  <Printer className="h-4 w-4" />
                  Imprimer / PDF
                </Link></Button>
            ) : null}
            {isReturn ? (
              <Button type="button" variant="secondary" asChild><Link href={`/vente/retours/${document.id}/print`} target="_blank">
                  <Printer className="h-4 w-4" />
                  Imprimer / PDF
                </Link></Button>
            ) : null}
            {isQuote && document.status === "draft" ? (
              <>
                <Button variant="secondary" asChild><Link href={`/vente/devis/${document.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
                <ActionForm label="Marquer envoye" icon={<Send className="h-4 w-4" />} action={actionWithId(markQuoteAsSent, document.id)} />
              </>
            ) : null}
            {isQuote && ["draft", "sent"].includes(document.status) ? (
              <>
                <ActionForm label="Accepter" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(acceptQuote, document.id)} />
                <ActionForm label="Rejeter" icon={<XCircle className="h-4 w-4" />} action={actionWithId(rejectQuote, document.id)} variant="danger" />
              </>
            ) : null}
            {isQuote && ["draft", "sent", "accepted"].includes(document.status) ? (
              <ActionForm label="Convertir en commande" action={actionWithId(convertQuoteToOrder, document.id)} />
            ) : null}
            {isOrder && document.status === "draft" ? (
              <>
                <Button variant="secondary" asChild><Link href={`/vente/commandes/${document.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
                <ActionForm label="Confirmer commande" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(confirmOrder, document.id)} />
              </>
            ) : null}
            {isOrder && ["confirmed", "partially_delivered"].includes(document.status) ? (
              <Button variant="secondary" asChild><Link href={`/vente/commandes/${document.id}/livrer`}><Truck className="h-4 w-4" /> Creer une livraison</Link></Button>
            ) : null}
            {isDelivery && document.status === "draft" ? (
              <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateDeliveryNote, document.id)} />
            ) : null}
            {isDelivery && document.status === "validated" ? (
              <ActionForm label="Marquer livre" icon={<Truck className="h-4 w-4" />} action={actionWithId(markDeliveryAsDelivered, document.id)} />
            ) : null}
            {isDelivery && ["validated", "delivered"].includes(document.status) ? (
              <Button variant="secondary" asChild><Link href={`/vente/livraisons/${document.id}/retour`}><Truck className="h-4 w-4" /> Creer un retour</Link></Button>
            ) : null}
            {isDelivery && ["validated", "delivered"].includes(document.status) && !deliveryBillingBlocked ? (
              <Button variant="secondary" asChild><Link href={`/facturation/factures/new?customerId=${document.customer_id}&deliveryNoteId=${document.id}`}><Receipt className="h-4 w-4" /> Facturer</Link></Button>
            ) : null}
            {isReturn && document.status === "draft" ? (
              <ActionForm label="Valider retour" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateReturnNote, document.id)} />
            ) : null}
            {isReturn && document.status === "validated" ? (
              returnCreditNote ? (
                <Button variant="secondary" asChild><Link href={`/facturation/avoirs/${returnCreditNote.id}`}><Receipt className="h-4 w-4" /> Voir avoir</Link></Button>
              ) : (
                <Button variant="secondary" asChild><Link href={`/facturation/avoirs/new?returnId=${document.id}`}><Receipt className="h-4 w-4" /> Creer avoir</Link></Button>
              )
            ) : null}
            {document.status !== "cancelled" && document.status !== "converted" ? (
              <ActionForm
                label="Archiver"
                icon={<Archive className="h-4 w-4" />}
                variant="danger"
                action={async (prev) => {
                  const formData = new FormData();
                  formData.set("id", document.id);
                  formData.set("document_type", document.document_type);
                  return archiveSalesDocument(prev, formData);
                }}
              />
            ) : null}
          </>
        }
      />

      <DocumentFlowMap steps={documentFlow ?? []} />

      {showBillingWarning ? (
        <Card className={hasBillingConflict ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${hasBillingConflict ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <p className={`font-semibold ${hasBillingConflict ? "text-red-900" : "text-amber-900"}`}>
                  {hasBillingConflict
                    ? "Attention : plusieurs factures sont liées à cette commande."
                    : directInvoice
                      ? "Facture directe historique"
                      : "Facturation via BL terminée"}
                </p>
                <p className={hasBillingConflict ? "text-red-700" : "text-amber-700"}>
                  {hasBillingConflict
                    ? "Cette commande possède plusieurs factures liées. Vérification requise avant toute nouvelle action."
                    : directInvoice
                      ? `Cette commande possède une facture directe historique ${directInvoice.invoice_number}.`
                      : firstDeliveryInvoice
                        ? `Cette commande a déjà été facturée via BL par ${firstDeliveryInvoice.invoice_number}.`
                        : billingGuard?.reason}
                </p>
                {isOrder && directInvoice ? (
                  <p className="mt-1 text-amber-700">Pour éviter une double facturation, les BL liés à cette commande ne seront pas facturables. Utilisez un avoir ou une correction comptable si cette facture est erronée.</p>
                ) : null}
                {isDelivery && directInvoice ? (
                  <p className="mt-1 text-amber-700">Ce BL est rattaché à une commande déjà facturée directement. Il ne peut pas être facturé.</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {directInvoice ? (
                <Button type="button" variant="secondary" asChild><Link href={`/facturation/factures/${directInvoice.id}`}>Voir {directInvoice.invoice_number}</Link></Button>
              ) : null}
              {deliveryInvoices.map((invoice) => (
                <Button key={invoice.id} type="button" variant="secondary" asChild><Link href={`/facturation/factures/${invoice.id}`}>Voir {invoice.invoice_number}</Link></Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isOrder && ["confirmed", "partially_delivered", "delivered"].includes(document.status) ? (
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="text-sm text-blue-800">
            Pour fiabiliser la facturation, une commande doit d’abord être livrée par bon de livraison validé. La facture sera créée ensuite à partir des BL validés.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <SalesStatusBadge status={document.status} />
          <Badge tone={recipientLabel.includes("Prospect") ? "warning" : "info"}>{recipientLabel}</Badge>
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(document.created_at)}</span>
          {document.source_document_number ? (
            <span className="text-sm text-[var(--muted)]">Source {document.source_document_number}</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Client / Prospect" value={document.customer_name} />
          <Info label="Date" value={formatDate(document.document_date)} />
          <Info label="Validite" value={document.valid_until ? formatDate(document.valid_until) : null} />
          <Info label="Livraison prevue" value={document.expected_delivery_date ? formatDate(document.expected_delivery_date) : null} />
          <Info label="Commande liee" value={document.related_order_number} />
          <Info label="BL lie" value={document.related_delivery_number} />
          {isReturn ? <Info label="Motif retour" value={document.return_reason} /> : null}
          {(document.payment_terms || document.payment_method) && !isDelivery && !isReturn ? (
            <>
              <Info label="Conditions de paiement" value={getPaymentTermLabel(document.payment_terms) || (document.payment_terms_days ? `${document.payment_terms_days} jours` : null)} />
              <Info label="Modalites de paiement" value={getPaymentMethodLabel(document.payment_method)} />
            </>
          ) : null}
          <Info
            label="Source"
            value={
              document.source_document_number && document.source_document_type === "quote" ? (
                <Link className="font-medium text-[var(--secondary)] hover:text-[var(--primary)]" href={`/vente/devis/${document.source_document_id}`}>
                  Voir le devis source
                </Link>
              ) : document.source_document_number
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <EmptyState title="Aucune ligne" description="Ce document ne contient aucune ligne." />
          ) : (
            <Table>
              {isDelivery ? (
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Article</Th>
                    <Th>Designation</Th>
                    <Th>Unite</Th>
                    <Th>Commande</Th>
                    <Th>Deja livre</Th>
                    <Th>Livre dans ce BL</Th>
                    <Th>Reste</Th>
                    <Th>Stock</Th>
                  </tr>
                </thead>
              ) : isReturn ? (
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Article</Th>
                    <Th>Designation</Th>
                    <Th>Unite</Th>
                    <Th>Livre dans le BL</Th>
                    <Th>Deja retourne</Th>
                    <Th>Retourne dans ce bon</Th>
                    <Th>Stock</Th>
                  </tr>
                </thead>
              ) : (
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Produit</Th>
                    <Th>Description</Th>
                    <Th>Quantite</Th>
                    <Th>Unite</Th>
                    <Th>Prix HT</Th>
                    {discountPresent ? <Th>Remise %</Th> : null}
                    <Th>Total HT</Th>
                    <Th>TVA %</Th>
                    <Th>Total TTC</Th>
                  </tr>
                </thead>
              )}
              <tbody>
                {lines.map((line, index) => {
                  const ordered = deliveryOrderedQuantity(line);
                  const alreadyDeliveredBefore = deliveryAlreadyDeliveredBefore(line);
                  const remaining = deliveryRemainingQuantity(line);

                  return isDelivery ? (
                    <tr key={line.id}>
                      <Td>{index + 1}</Td>
                      <Td>{line.product_name || "Ligne libre"}</Td>
                      <Td>{line.description}</Td>
                      <Td>{line.unit_name ?? "-"}</Td>
                      <Td>{ordered === null ? "-" : formatNumber(ordered)}</Td>
                      <Td>{alreadyDeliveredBefore === null ? "-" : formatNumber(alreadyDeliveredBefore)}</Td>
                      <Td className="font-semibold text-[var(--secondary)]">{formatNumber(line.quantity)}</Td>
                      <Td><DeliveryProgressBadge remaining={remaining} /></Td>
                      <Td>{line.stock_move_id ? "Impacte" : document.stock_updated_at ? "Non impacte" : "En attente"}</Td>
                    </tr>
                  ) : isReturn ? (
                    <tr key={line.id}>
                      <Td>{index + 1}</Td>
                      <Td>{line.product_name || "Ligne libre"}</Td>
                      <Td>{line.description}</Td>
                      <Td>{line.unit_name ?? "-"}</Td>
                      <Td>{line.ordered_quantity === null ? "-" : formatNumber(line.ordered_quantity)}</Td>
                      <Td>{formatNumber(line.returned_quantity)}</Td>
                      <Td className="font-semibold text-[var(--secondary)]">{formatNumber(line.quantity)}</Td>
                      <Td>{line.stock_move_id ? "Reintegre" : document.stock_updated_at ? "Non impacte" : "En attente"}</Td>
                    </tr>
                  ) : (
                    <tr key={line.id}>
                      <Td>{index + 1}</Td>
                      <Td>{line.product_name || "Ligne libre"}</Td>
                      <Td>{line.description}</Td>
                      <Td>{line.quantity}</Td>
                      <Td>{line.unit_name ?? "-"}</Td>
                      <Td><MoneyDisplay value={line.unit_price_ht} /></Td>
                      {discountPresent ? <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td> : null}
                      <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                      <Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td>
                      <Td><MoneyDisplay value={line.total_ttc} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isLogisticsDocument ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Totaux</h2></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Info label="Total HT" value={<MoneyDisplay value={document.subtotal_ht} />} />
            <Info label="Total TVA" value={<MoneyDisplay value={document.tax_total} />} />
            <Info label="Total TTC" value={<span className="font-semibold"><MoneyDisplay value={document.total_ttc} /></span>} />
          </CardContent>
        </Card>
      ) : null}

      {isLogisticsDocument ? (
        <Card>
          <CardContent className="text-sm text-[var(--muted)]">
            {document.stock_updated_at ? (
              isReturn
                ? `Stock reintegre le ${formatDate(document.stock_updated_at)}.`
                : `Stock mis a jour le ${formatDate(document.stock_updated_at)}.`
            ) : isReturn ? (
              "Stock non encore reintegre. Il sera impacte a la validation du bon de retour."
            ) : (
              "Stock non encore mis a jour. Il sera impacte a la validation du bon de livraison."
            )}
          </CardContent>
        </Card>
      ) : null}

      {isReturn ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Avoir client</h2></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {returnCreditNote ? (
              <>
                <div>
                  <p className="font-medium">{returnCreditNote.credit_note_number}</p>
                  <p className="text-[var(--muted)]">
                    Statut : {returnCreditNote.status} · Total : <MoneyDisplay value={returnCreditNote.total_ttc} /> · Disponible : <MoneyDisplay value={returnCreditNote.available_amount} />
                  </p>
                </div>
                <Button type="button" variant="secondary" asChild><Link href={`/facturation/avoirs/${returnCreditNote.id}`}>Voir avoir</Link></Button>
              </>
            ) : document.status === "validated" ? (
              <>
                <p className="text-[var(--muted)]">Aucun avoir financier n&apos;est encore rattache a ce bon de retour.</p>
                <Button type="button" variant="secondary" asChild><Link href={`/facturation/avoirs/new?returnId=${document.id}`}><Receipt className="h-4 w-4" /> Creer avoir</Link></Button>
              </>
            ) : (
              <p className="text-[var(--muted)]">Validez d&apos;abord le bon de retour avant de creer un avoir.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {document.notes || document.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Notes client" value={document.notes} />
            <Info label="Notes internes" value={document.internal_notes} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
