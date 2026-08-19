import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { DeliveryNoteRecord } from "@/lib/commerce-types";
import { formatDate } from "@/lib/format";

export function DeliveriesTable({ rows }: { rows: DeliveryNoteRecord[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th>
          <Th>Client</Th>
          <Th>Commande liee</Th>
          <Th>Date livraison</Th>
          <Th>Statut</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucun bon de livraison trouve.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-mono text-xs">{row.number ?? "-"}</Td>
            <Td>
              <Link href={`/livraisons/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.customer_name ?? "-"}
              </Link>
            </Td>
            <Td className="text-sm">{row.order_number ?? "-"}</Td>
            <Td className="text-sm">{row.delivery_date ? formatDate(row.delivery_date) : "-"}</Td>
            <Td><StatusBadge status={row.status} /></Td>
            <Td>
              <div className="flex items-center gap-2">
                <Button variant="ghost"  asChild><Link href={`/livraisons/${row.id}`}>Consulter</Link></Button>
                {["draft"].includes(row.status) ? (
                  <Button variant="ghost"  asChild><Link href={`/livraisons/${row.id}/edit`}><Pencil className="h-3 w-3" /></Link></Button>
                ) : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
