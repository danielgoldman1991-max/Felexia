"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil, Send, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { SalesStatusBadge } from "@/components/sales/sales-status-badge";
import { formatDate } from "@/lib/format";
import {
  acceptQuote,
  archiveSalesDocument,
  confirmOrder,
  convertQuoteToOrder,
  createDeliveryFromOrder,
  markDeliveryAsDelivered,
  markQuoteAsSent,
  rejectQuote,
  validateDeliveryNote,
} from "@/lib/sales-actions";
import type { SalesActionResult, SalesDocumentLineRecord, SalesDocumentRecord } from "@/lib/sales-types";
import { SALES_DOCUMENT_LABELS } from "@/lib/sales-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

function actionWithId(action: (prev: SalesActionResult, formData: FormData) => Promise<SalesActionResult>, id: string) {
  return (prev: SalesActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
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
}: {
  document: SalesDocumentRecord;
  lines: SalesDocumentLineRecord[];
}) {
  const isQuote = document.document_type === "quote";
  const isOrder = document.document_type === "order";
  const isDelivery = document.document_type === "delivery_note";
  const title = `${SALES_DOCUMENT_LABELS[document.document_type]} ${document.document_number}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={document.customer_name ?? ""}
        actions={
          <>
            {isQuote && document.status === "draft" ? (
              <>
                <Link href={`/vente/devis/${document.id}/edit`}>
                  <Button variant="secondary"><Pencil className="h-4 w-4" /> Modifier</Button>
                </Link>
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
              <ActionForm label="Confirmer commande" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(confirmOrder, document.id)} />
            ) : null}
            {isOrder && ["draft", "confirmed"].includes(document.status) ? (
              <ActionForm label="Creer bon de livraison" icon={<Truck className="h-4 w-4" />} action={actionWithId(createDeliveryFromOrder, document.id)} />
            ) : null}
            {isDelivery && document.status === "draft" ? (
              <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateDeliveryNote, document.id)} />
            ) : null}
            {isDelivery && document.status === "validated" ? (
              <ActionForm label="Marquer livre" icon={<Truck className="h-4 w-4" />} action={actionWithId(markDeliveryAsDelivered, document.id)} />
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

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <SalesStatusBadge status={document.status} />
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(document.created_at)}</span>
          {document.source_document_number ? (
            <span className="text-sm text-[var(--muted)]">Source {document.source_document_number}</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Client" value={document.customer_name} />
          <Info label="Date" value={formatDate(document.document_date)} />
          <Info label="Validite" value={document.valid_until ? formatDate(document.valid_until) : null} />
          <Info label="Livraison prevue" value={document.expected_delivery_date ? formatDate(document.expected_delivery_date) : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <EmptyState title="Aucune ligne" description="Ce document ne contient aucune ligne." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Produit</Th>
                  <Th>Description</Th>
                  <Th>Quantite</Th>
                  <Th>Unite</Th>
                  <Th>Prix HT</Th>
                  <Th>Remise %</Th>
                  <Th>Total HT</Th>
                  <Th>TVA %</Th>
                  <Th>Total TTC</Th>
                </tr>
              </thead>
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
          <Info label="Total HT" value={<MoneyDisplay value={document.subtotal_ht} />} />
          <Info label="Total TVA" value={<MoneyDisplay value={document.tax_total} />} />
          <Info label="Total TTC" value={<span className="font-semibold"><MoneyDisplay value={document.total_ttc} /></span>} />
        </CardContent>
      </Card>

      {isDelivery ? (
        <Card>
          <CardContent className="text-sm text-[var(--muted)]">
            La mise a jour automatique du stock sera branchee dans le module Stock.
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
