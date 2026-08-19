import Link from "next/link";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";
import type { StockMovementRecord } from "@/lib/stock-types";
import { StockDirectionBadge, StockMoveTypeBadge } from "@/components/stock/stock-move-type-badge";

function documentHref(documentType: string | null, id: string | null) {
  if (!id || !documentType) return null;
  if (documentType === "delivery_note") return `/vente/livraisons/${id}`;
  if (documentType === "return_note") return `/vente/retours/${id}`;
  if (documentType === "order") return `/vente/commandes/${id}`;
  if (documentType === "quote") return `/vente/devis/${id}`;
  if (documentType === "supplier_receipt") return `/achats/receptions/${id}`;
  if (documentType === "supplier_order") return `/achats/commandes/${id}`;
  return null;
}

export function StockMovementsTable({ movements, unitSymbol }: { movements: StockMovementRecord[]; unitSymbol?: string | null }) {
  if (movements.length === 0) {
    return <EmptyState title="Aucun mouvement" description="Aucun mouvement ne correspond a cet article et ces filtres." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Type</Th>
          <Th>Direction</Th>
          <Th>Quantite</Th>
          <Th>Solde apres</Th>
          <Th>Depot</Th>
          <Th>Document source</Th>
          <Th>Notes</Th>
          <Th>Utilisateur</Th>
        </tr>
      </thead>
      <tbody>
        {movements.map((movement) => {
          const href = documentHref(movement.source_document_type, movement.source_document_id);

          return (
            <tr key={movement.id}>
              <Td>{formatDate(movement.movement_date)}</Td>
              <Td><StockMoveTypeBadge type={movement.move_type} /></Td>
              <Td><StockDirectionBadge direction={movement.direction} /></Td>
              <Td className={movement.direction === "in" ? "font-semibold text-[var(--success)]" : "font-semibold text-[var(--warning)]"}>
                {movement.direction === "in" ? "+" : "-"}{formatNumber(movement.quantity)} {unitSymbol ?? ""}
              </Td>
              <Td>{formatNumber(movement.balance_after)} {unitSymbol ?? ""}</Td>
              <Td>{movement.warehouse_name ?? "-"}</Td>
              <Td>
                {href && movement.source_document_number ? (
                  <Link className="font-medium text-[var(--secondary)] hover:text-[var(--primary)]" href={href}>
                    {movement.source_document_number}
                  </Link>
                ) : movement.source_document_number ?? "-"}
              </Td>
              <Td>{movement.notes ?? "-"}</Td>
              <Td>{movement.created_by_name ?? "-"}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
