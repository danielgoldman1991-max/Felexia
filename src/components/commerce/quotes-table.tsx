import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { SalesQuoteRecord } from "@/lib/commerce-types";
import { formatDate } from "@/lib/format";

export function QuotesTable({ rows }: { rows: SalesQuoteRecord[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th>
          <Th>Client</Th>
          <Th>Date</Th>
          <Th>Validite</Th>
          <Th>Statut</Th>
          <Th>Total TTC</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucun devis trouve.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-mono text-xs">{row.number ?? "-"}</Td>
            <Td>
              <Link href={`/devis/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.customer_name ?? "-"}
              </Link>
            </Td>
            <Td className="text-sm">{formatDate(row.document_date)}</Td>
            <Td className="text-sm">{row.valid_until ? formatDate(row.valid_until) : "-"}</Td>
            <Td><StatusBadge status={row.status} /></Td>
            <Td><MoneyDisplay value={row.total_ttc} /></Td>
            <Td>
              <div className="flex items-center gap-2">
                <Button variant="ghost"  asChild><Link href={`/devis/${row.id}`}>Consulter</Link></Button>
                {["draft", "sent"].includes(row.status) ? (
                  <Button variant="ghost"  asChild><Link href={`/devis/${row.id}/edit`}><Pencil className="h-3 w-3" /></Link></Button>
                ) : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
