import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { SalesStatusBadge } from "@/components/sales/sales-status-badge";
import { formatDate } from "@/lib/format";
import type { SalesDocumentRecord, SalesDocumentType } from "@/lib/sales-types";

const pathByType: Record<SalesDocumentType, string> = {
  quote: "/vente/devis",
  order: "/vente/commandes",
  delivery_note: "/vente/livraisons",
};

export function SalesDocumentsTable({ rows, type }: { rows: SalesDocumentRecord[]; type: SalesDocumentType }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucun document"
        description="Les documents de vente apparaitront ici progressivement."
      />
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th>
          <Th>Client</Th>
          <Th>Date</Th>
          <Th>Statut</Th>
          <Th>Total TTC</Th>
          <Th>Source</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-medium">{row.document_number}</Td>
            <Td>{row.customer_name ?? "-"}</Td>
            <Td>{formatDate(row.document_date)}</Td>
            <Td><SalesStatusBadge status={row.status} /></Td>
            <Td><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>{row.source_document_number ?? "-"}</Td>
            <Td>
              <Link href={`${pathByType[type]}/${row.id}`}>
                <Button type="button" variant="secondary">Consulter</Button>
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
