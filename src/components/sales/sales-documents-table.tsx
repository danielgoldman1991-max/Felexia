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
  return_note: "/vente/retours",
};

export function SalesDocumentsTable({ rows, type }: { rows: SalesDocumentRecord[]; type: SalesDocumentType }) {
  const isOrderTable = type === "order";
  const isDeliveryTable = type === "delivery_note";
  const isReturnTable = type === "return_note";
  const isLogisticsTable = isDeliveryTable || isReturnTable;

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
          {isOrderTable ? <Th>Livraison prevue</Th> : null}
          {isReturnTable ? <Th>Motif</Th> : null}
          <Th>Statut</Th>
          {isLogisticsTable ? <Th>Stock</Th> : <Th>Total TTC</Th>}
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
            {isOrderTable ? (
              <Td>{row.expected_delivery_date ? formatDate(row.expected_delivery_date) : "-"}</Td>
            ) : null}
            {isReturnTable ? <Td>{row.return_reason ?? "-"}</Td> : null}
            <Td><SalesStatusBadge status={row.status} /></Td>
            {isLogisticsTable ? (
              <Td>{row.stock_updated_at ? "Mis a jour" : "En attente"}</Td>
            ) : (
              <Td><MoneyDisplay value={row.total_ttc} /></Td>
            )}
            <Td>{row.source_document_number ?? "-"}</Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                <Link href={`${pathByType[type]}/${row.id}`}>
                  <Button type="button" variant="secondary">Consulter</Button>
                </Link>
                {isOrderTable && row.status === "draft" ? (
                  <Link href={`${pathByType[type]}/${row.id}/edit`}>
                    <Button type="button" variant="ghost">Modifier</Button>
                  </Link>
                ) : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
