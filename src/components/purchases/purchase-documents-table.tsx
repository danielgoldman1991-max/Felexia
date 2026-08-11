import Link from "next/link";
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

export function PurchaseDocumentsTable({ rows, type }: { rows: PurchaseDocumentRecord[]; type: PurchaseDocumentType }) {
  const isReceipt = type === "supplier_receipt";
  if (rows.length === 0) return <EmptyState title="Aucun document" description="Les documents achats apparaitront ici." />;
  return (
    <Table>
      <thead><tr>
        <Th>Numero</Th>
        <Th>Fournisseur</Th>
        <Th>Date</Th>
        <Th>Total TTC</Th>
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
            <Td><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>{isReceipt ? <SupplierReceiptStatusBadge status={row.status} /> : <SupplierOrderStatusBadge status={row.status} />}</Td>
            {isReceipt ? (
              <Td>
                {row.stock_updated_at ? (
                  <Badge tone="success">Mis a jour</Badge>
                ) : (
                  <Badge tone="neutral">Non mis a jour</Badge>
                )}
              </Td>
            ) : null}
            <Td>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" asChild><Link href={`/achats/${isReceipt ? "receptions" : "commandes"}/${row.id}`}>Consulter</Link></Button>
                {isReceipt && row.status === "validated" ? (
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
  if (rows.length === 0) return <EmptyState title="Aucune facture" description="Les factures fournisseurs apparaitront ici." />;
  return (
    <Table>
      <thead><tr>
        <Th>N Facture</Th>
        <Th>N fournisseur</Th>
        <Th>Fournisseur</Th>
        <Th>Date</Th>
        <Th>Total TTC</Th>
        <Th>Statut</Th>
        <Th>Paiement</Th>
        <Th>Actions</Th>
      </tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-medium">{row.invoice_number}</Td>
            <Td className="text-xs text-[var(--muted)]">{row.supplier_invoice_number ?? "-"}</Td>
            <Td>{row.supplier_name ?? "-"}</Td>
            <Td>{formatDate(row.invoice_date)}</Td>
            <Td><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>
              <div className="flex flex-wrap items-center gap-2">
                <SupplierInvoiceStatusBadge status={row.status} />
                {isSupplierInvoiceFromReceipt(row) ? <Badge tone="neutral">Issue réception</Badge> : null}
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
              <Button type="button" variant="secondary" asChild><Link href={`/achats/factures/${row.id}`}>Consulter</Link></Button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
