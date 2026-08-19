"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Archive, CheckCircle2, FileText, Package, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate, formatNumber } from "@/lib/format";
import { SupplierReceiptStatusBadge } from "@/components/purchases/purchase-status-badge";
import { validateSupplierReceipt, cancelSupplierReceipt, archivePurchaseDocument } from "@/lib/purchase-actions";
import type { PurchaseActionResult, PurchaseDocumentLineRecord, PurchaseDocumentRecord, PurchaseReceiptArchiveEligibility, SupplierInvoiceRecord, StockMoveForReceipt } from "@/lib/purchase-types";
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

export function SupplierReceiptDetail({
  document,
  lines,
  documentFlow,
  existingInvoice,
  archiveEligibility,
  stockMoves,
}: {
  document: PurchaseDocumentRecord;
  lines: PurchaseDocumentLineRecord[];
  documentFlow?: DocumentFlowStep[];
  existingInvoice?: SupplierInvoiceRecord | null;
  archiveEligibility?: PurchaseReceiptArchiveEligibility | null;
  stockMoves?: StockMoveForReceipt[];
}) {
  const canValidate = document.status === "draft";
  const canCancel = document.status === "draft";
  const canArchive = archiveEligibility?.canArchive ?? (document.status === "draft" && !document.stock_updated_at && !existingInvoice);
  const isInvoiced = Boolean(existingInvoice);

  const title = `${PURCHASE_DOCUMENT_LABELS[document.document_type]} ${document.document_number}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={document.supplier_name ?? ""}
        actions={
          <>
            {isInvoiced ? (
              <Button variant="secondary" asChild><Link href={`/achats/factures/${existingInvoice!.id}`}><FileText className="h-4 w-4" /> Voir facture</Link></Button>
            ) : document.status === "validated" ? (
              <Button variant="secondary" asChild><Link href={`/achats/factures/new?receiptId=${document.id}`}><FileText className="h-4 w-4" /> Creer facture</Link></Button>
            ) : null}
            {canValidate ? (
              <ActionForm label="Valider reception" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateSupplierReceipt, document.id)} />
            ) : null}
            <Button variant="secondary" asChild><Link href={`/achats/receptions/${document.id}/print`} target="_blank"><Printer className="h-4 w-4" /> Imprimer</Link></Button>
            {canCancel ? (
              <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelSupplierReceipt, document.id)} />
            ) : null}
            {canArchive ? (
              <ActionForm label="Archiver" icon={<Archive className="h-4 w-4" />} variant="danger" action={async (prev) => {
                const fd = new FormData();
                fd.set("id", document.id);
                fd.set("document_type", document.document_type);
                return archivePurchaseDocument(prev, fd);
              }} />
            ) : null}
          </>
        }
      />

      <DocumentFlowMap steps={documentFlow ?? []} />

      {!canArchive ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm text-blue-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Cette reception ne peut pas etre archivee directement.</p>
                <p className="mt-1 text-blue-900">
                  Elle est validée, facturée ou liée à des mouvements de stock. Cette restriction préserve la traçabilité du flux achat.
                </p>
                {archiveEligibility?.reasons?.length ? (
                  <p className="mt-2 text-xs text-blue-800">Raisons : {archiveEligibility.reasons.join(", ")}.</p>
                ) : null}
              </div>
            </div>
            {existingInvoice ? (
              <Button type="button" variant="secondary" className="bg-white" asChild><Link href={`/achats/factures/${existingInvoice.id}`}>Voir la facture liée</Link></Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <SupplierReceiptStatusBadge status={document.status} />
          <span className="text-sm text-[var(--muted)]">Créé le {formatDate(document.created_at)}</span>
          {document.stock_updated_at ? <span className="text-sm text-green-600">Stock mis à jour</span> : <span className="text-sm text-amber-600">Stock non mis à jour</span>}
          {document.related_order_number ? <span className="text-sm text-[var(--muted)]">Commande : {document.related_order_number}</span> : null}
          {isInvoiced ? <Badge tone="success">Facturée</Badge> : document.status === "validated" ? <Badge tone="neutral">Non facturée</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Fournisseur" value={document.supplier_name} />
          <Info label="Date réception" value={formatDate(document.receipt_date ?? document.document_date)} />
          <Info label="Emplacement" value={document.warehouse_name ?? <span className="text-gray-400">Non renseigné</span>} />
          <Info label="Notes" value={document.notes} />
          <Info label="Notes internes" value={document.internal_notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? <EmptyState title="Aucune ligne" description="Cette réception ne contient aucune ligne." /> : (
            <Table>
              <thead><tr>
                <Th>#</Th>
                <Th>Article</Th>
                <Th>Description</Th>
                <Th>Unite</Th>
                <Th className="text-right">Qte recue</Th>
                <Th className="text-right">Prix HT</Th>
                <Th className="text-right">Remise %</Th>
                <Th className="text-right">Total HT</Th>
                <Th className="text-right">TVA %</Th>
                <Th className="text-right">Total TTC</Th>
              </tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <Td>{index + 1}</Td>
                    <Td>{line.product_name || "Ligne libre"}</Td>
                    <Td>{line.description}</Td>
                    <Td>{line.unit_name ?? "-"}</Td>
                    <Td className="text-right font-semibold">{formatNumber(line.quantity)}</Td>
                    <Td className="text-right"><MoneyDisplay value={line.unit_price_ht} /></Td>
                    <Td className="text-right">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                    <Td className="text-right"><MoneyDisplay value={line.subtotal_ht} /></Td>
                    <Td className="text-right">{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td>
                    <Td className="text-right"><MoneyDisplay value={line.total_ttc} /></Td>
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

      {stockMoves && stockMoves.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="font-semibold">Mouvements de stock</h2>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Produit</Th><Th>Quantite</Th><Th>Direction</Th><Th>Type</Th><Th>Entrepot</Th><Th>Date</Th></tr></thead>
              <tbody>
                {stockMoves.map((move) => (
                  <tr key={move.id}>
                    <Td>{move.product_name ?? "-"}</Td>
                    <Td className="text-right">{formatNumber(move.quantity)}</Td>
                    <Td>
                      {move.direction === "in" ? (
                        <Badge tone="success">Entree</Badge>
                      ) : (
                        <Badge tone="danger">Sortie</Badge>
                      )}
                    </Td>
                    <Td>{move.move_type}</Td>
                    <Td>{move.warehouse_name ?? "-"}</Td>
                    <Td>{move.movement_date ? formatDate(move.movement_date) : "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ) : document.stock_updated_at ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="font-semibold">Mouvements de stock</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted)]">Le stock a ete mis a jour le {formatDate(document.stock_updated_at)}, mais les mouvements detailles ne sont pas disponibles.</p>
          </CardContent>
        </Card>
      ) : null}

      {isInvoiced && existingInvoice ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="font-semibold">Facture associee</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Numero" value={existingInvoice.invoice_number} />
            <Info label="Date" value={formatDate(existingInvoice.invoice_date)} />
            <Info label="Total TTC" value={<MoneyDisplay value={existingInvoice.total_ttc} />} />
            <Info label="Reste a payer" value={<MoneyDisplay value={existingInvoice.remaining_amount} />} />
            <div className="md:col-span-2">
              <Button variant="secondary" asChild><Link href={`/achats/factures/${existingInvoice.id}`}><FileText className="h-4 w-4" /> Consulter la facture</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : document.status === "validated" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="font-semibold">Facturation</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted)]">Cette reception n&apos;est pas encore facturee.</p>
            <div className="mt-3">
              <Button asChild><Link href={`/achats/factures/new?receiptId=${document.id}`}><FileText className="h-4 w-4" /> Creer la facture fournisseur</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
