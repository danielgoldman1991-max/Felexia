"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate, formatNumber } from "@/lib/format";
import { SupplierReceiptStatusBadge } from "@/components/purchases/purchase-status-badge";
import { validateSupplierReceipt, cancelSupplierReceipt, archivePurchaseDocument } from "@/lib/purchase-actions";
import type { PurchaseActionResult, PurchaseDocumentLineRecord, PurchaseDocumentRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";
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

export function SupplierReceiptDetail({ document, lines, documentFlow, existingInvoice }: { document: PurchaseDocumentRecord; lines: PurchaseDocumentLineRecord[]; documentFlow?: DocumentFlowStep[]; existingInvoice?: SupplierInvoiceRecord | null }) {
  const canValidate = document.status === "draft";
  const canCancel = document.status === "draft";

  const title = `${PURCHASE_DOCUMENT_LABELS[document.document_type]} ${document.document_number}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={document.supplier_name ?? ""}
        actions={
          <>
            {existingInvoice ? (
              <Link href={`/achats/factures/${existingInvoice.id}`}>
                <Button variant="secondary">Voir facture</Button>
              </Link>
            ) : document.status === "validated" ? (
              <Link href={`/achats/factures/new?receiptId=${document.id}`}>
                <Button variant="secondary">Creer facture</Button>
              </Link>
            ) : null}
            {canValidate ? (
              <ActionForm label="Valider reception" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateSupplierReceipt, document.id)} />
            ) : null}
            <Link href={`/achats/receptions/${document.id}/print`} target="_blank">
              <Button variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button>
            </Link>
            {canCancel ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierReceipt, document.id)} />
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
          <SupplierReceiptStatusBadge status={document.status} />
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(document.created_at)}</span>
          {document.stock_updated_at ? <span className="text-sm text-green-600">Stock mis a jour</span> : <span className="text-sm text-amber-600">Stock non mis a jour</span>}
          {document.related_order_number ? <span className="text-sm text-[var(--muted)]">Commande: {document.related_order_number}</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Info label="Fournisseur" value={document.supplier_name} />
          <Info label="Date reception" value={formatDate(document.receipt_date ?? document.document_date)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? <EmptyState title="Aucune ligne" description="Cette reception ne contient aucune ligne." /> : (
            <Table>
              <thead><tr><Th>#</Th><Th>Article</Th><Th>Designation</Th><Th>Unite</Th><Th>Quantite recue</Th><Th>Emplacement</Th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <Td>{index + 1}</Td>
                    <Td>{line.product_name || "Ligne libre"}</Td>
                    <Td>{line.description}</Td>
                    <Td>{line.unit_name ?? "-"}</Td>
                    <Td className="font-semibold">{formatNumber(line.quantity)}</Td>
                    <Td>{document.warehouse_name ? <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">{document.warehouse_name}</span> : <span className="text-xs text-gray-400">Non renseigne</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
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
