import Link from "next/link";
import { Eye, PackageCheck, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { formatDate } from "@/lib/format";
import { SupplierOrderStatusBadge, SupplierReceiptStatusBadge } from "@/components/purchases/purchase-status-badge";
import type { PurchaseDocumentRecord, PurchaseDocumentType } from "@/lib/purchase-types";
import { isSupplierInvoiceFromReceipt, type SupplierInvoiceRecord } from "@/lib/purchase-types";
import { SupplierInvoiceStatusBadge } from "@/components/purchases/supplier-invoice-status-badge";

export function PurchaseDocumentsTable({ rows, type, canWrite = false }: { rows: PurchaseDocumentRecord[]; type: PurchaseDocumentType; canWrite?: boolean }) {
  const isReceipt = type === "supplier_receipt";
  if (rows.length === 0) return <EmptyState title={isReceipt ? "Aucune réception pour le moment" : "Aucune commande pour le moment"} description="Vos documents d’achat et leur suivi apparaîtront ici." icon={<PackageCheck className="h-6 w-6" />} />;
  return (
    <Table>
      <thead><tr>
        <Th>Numéro</Th>
        <Th>Fournisseur</Th>
        <Th>Date</Th>
        <Th className="text-right">Total TTC</Th>
        <Th>Statut</Th>
        {isReceipt ? <Th>Stock</Th> : null}
        <Th>Actions</Th>
      </tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-medium">{row.document_number}</Td>
            <Td>{row.supplier_name ?? "-"}</Td>
            <Td>{formatDate(row.document_date)}</Td>
            <Td className="text-right tabular-nums"><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>{isReceipt ? <SupplierReceiptStatusBadge status={row.status} /> : <SupplierOrderStatusBadge status={row.status} />}</Td>
            {isReceipt ? (
              <Td>
                {row.stock_updated_at ? (
                  <Badge tone="success">Mis à jour</Badge>
                ) : (
                  <Badge tone="neutral">Non mis à jour</Badge>
                )}
              </Td>
            ) : null}
            <Td>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" asChild><Link href={`/achats/${isReceipt ? "receptions" : "commandes"}/${row.id}`}>Consulter</Link></Button>
                {canWrite && isReceipt && row.status === "validated" ? (
                  <Button type="button" variant="secondary" asChild><Link href={`/achats/factures/new?receiptId=${row.id}`}>Facturer</Link></Button>
                ) : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function SupplierInvoicesTable({ rows }: { rows: SupplierInvoiceRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucune facture d’achat pour le moment" description="Enregistrez une facture fournisseur pour suivre vos achats et préparer son règlement." icon={<ReceiptText className="h-6 w-6" />} />;
  return (
    <Table>
      <thead><tr>
        <Th>Numéro</Th>
        <Th>Fournisseur</Th>
        <Th>Date</Th>
        <Th className="text-right">Total TTC</Th>
        <Th>Statut</Th>
        <Th>Règlement</Th>
        <Th>Actions</Th>
      </tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td><Link href={`/achats/factures/${row.id}`} className="font-semibold text-[var(--primary)] hover:underline">{row.invoice_number}</Link><p className="mt-1 max-w-44 truncate text-xs text-[var(--muted)]" title={row.supplier_invoice_number ?? undefined}>Réf. frs : {row.supplier_invoice_number ?? "—"}</p></Td>
            <Td><span className="block max-w-44 truncate" title={row.supplier_name ?? undefined}>{row.supplier_name ?? "—"}</span></Td>
            <Td>{formatDate(row.invoice_date)}</Td>
            <Td className="text-right tabular-nums"><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>
              <div className="flex flex-wrap items-center gap-2">
                <SupplierInvoiceStatusBadge status={row.status} />
                {isSupplierInvoiceFromReceipt(row) ? <Badge tone="neutral">Issue d’une réception</Badge> : null}
              </div>
            </Td>
            <Td>
              {row.remaining_amount > 0 ? (
                <div className="flex flex-col gap-1">
                  <MoneyDisplay value={row.remaining_amount} />
                  <span className="text-xs text-[var(--muted)]">Reste à payer</span>
                </div>
              ) : (
                <Badge tone="success">Payée</Badge>
              )}
            </Td>
            <Td>
              <Button type="button" variant="ghost" className="h-9 w-9 px-0" asChild><Link href={`/achats/factures/${row.id}`} title="Consulter la facture" aria-label={`Consulter la facture ${row.invoice_number}`}><Eye className="h-4 w-4" /></Link></Button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
