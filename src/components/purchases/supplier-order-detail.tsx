"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil, Printer, Truck, XCircle } from "lucide-react";
import { SupplierOrderSendActions } from "@/components/purchases/supplier-order-send-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate, formatNumber } from "@/lib/format";
import { SupplierOrderStatusBadge } from "@/components/purchases/purchase-status-badge";
import { confirmSupplierOrder, cancelSupplierOrder, archivePurchaseDocument } from "@/lib/purchase-actions";
import type { PurchaseActionResult, PurchaseDocumentLineRecord, PurchaseDocumentRecord } from "@/lib/purchase-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import { PURCHASE_DOCUMENT_LABELS } from "@/lib/purchase-types";

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

export function SupplierOrderDetail({ document, lines, documentFlow }: { document: PurchaseDocumentRecord; lines: PurchaseDocumentLineRecord[]; documentFlow?: DocumentFlowStep[] }) {
  const canEdit = document.status === "draft";
  const canConfirm = document.status === "draft";
  const canCancel = !["cancelled", "received"].includes(document.status);
  const canCreateReceipt = ["confirmed", "partially_received"].includes(document.status);

  const title = `${PURCHASE_DOCUMENT_LABELS[document.document_type]} ${document.document_number}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={document.supplier_name ?? ""}
        actions={
          <>
            {canEdit ? (
              <Button variant="secondary" asChild><Link href={`/achats/commandes/${document.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
            ) : null}
            {canConfirm ? (
              <ActionForm label="Confirmer" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(confirmSupplierOrder, document.id)} />
            ) : null}
            {canCreateReceipt ? (
              <Button variant="secondary" asChild><Link href={`/achats/receptions/new?orderId=${document.id}`}><Truck className="h-4 w-4" /> Creer reception</Link></Button>
            ) : null}
            <Button variant="secondary" asChild><Link href={`/achats/commandes/${document.id}/print`} target="_blank"><Printer className="h-4 w-4" /> Imprimer</Link></Button>
            <SupplierOrderSendActions document={document} />
            {canCancel ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierOrder, document.id)} />
            ) : null}
            <ActionForm label="Archiver" icon={<Archive className="h-4 w-4" />} variant="danger" action={async (prev) => {
              const fd = new FormData();
              fd.set("id", document.id);
              fd.set("document_type", document.document_type);
              return archivePurchaseDocument(prev, fd);
            }} />
          </>
        }
      />

      <DocumentFlowMap steps={documentFlow ?? []} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <SupplierOrderStatusBadge status={document.status} />
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(document.created_at)}</span>
          {document.source_document_number ? <span className="text-sm text-[var(--muted)]">Source {document.source_document_number}</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Fournisseur" value={document.supplier_name} />
          <Info label="Date commande" value={formatDate(document.document_date)} />
          <Info label="Reception prevue" value={document.expected_receipt_date ? formatDate(document.expected_receipt_date) : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? <EmptyState title="Aucune ligne" description="Cette commande ne contient aucune ligne." /> : (
            <Table>
              <thead><tr><Th>#</Th><Th>Produit</Th><Th>Description</Th><Th>Quantite</Th><Th>Unite</Th><Th>Prix HT</Th><Th>Remise %</Th><Th>Total HT</Th><Th>TVA %</Th><Th>Total TTC</Th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <Td>{index + 1}</Td>
                    <Td>{line.product_name || "Ligne libre"}</Td>
                    <Td>{line.description}</Td>
                    <Td>{formatNumber(line.quantity)}</Td>
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

      {document.notes || document.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Notes" value={document.notes} />
            <Info label="Notes internes" value={document.internal_notes} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
