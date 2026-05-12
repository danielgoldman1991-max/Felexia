import Link from "next/link";
import { Eye, Pencil, Printer } from "lucide-react";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { AccountingStatusBadge } from "@/components/invoices/accounting-status-badge";
import { InvoicePaymentStatusBadge, InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatDate } from "@/lib/format";
import type { CustomerInvoiceRecord } from "@/lib/invoice-types";

export function CustomerInvoicesTable({ rows }: { rows: CustomerInvoiceRecord[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Aucune facture" description="Les factures clients apparaitront ici." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th><Th>Client</Th><Th>Date</Th><Th>Echeance</Th><Th>Statut</Th><Th>Paiement</Th><Th>Compta</Th><Th>Total TTC</Th><Th>Paye</Th><Th>Reste</Th><Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link
                href={`/facturation/factures/${row.id}`}
                className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                {row.invoice_number}
              </Link>
            </Td>
            <Td>{row.customer_name ?? "-"}</Td>
            <Td>{formatDate(row.invoice_date)}</Td>
            <Td>{row.due_date ? formatDate(row.due_date) : "-"}</Td>
            <Td><InvoiceStatusBadge status={row.status} /></Td>
            <Td><InvoicePaymentStatusBadge status={row.payment_status} /></Td>
            <Td>
              <AccountingStatusBadge
                status={row.accounting_status}
                entryId={row.accounting_entry_id}
                entryNumber={row.accounting_entry_number}
              />
            </Td>
            <Td><MoneyDisplay value={row.total_ttc} /></Td>
            <Td><MoneyDisplay value={row.paid_amount} /></Td>
            <Td><MoneyDisplay value={row.remaining_amount} /></Td>
            <Td>
              <div className="flex items-center gap-1">
                <Link
                  href={`/facturation/factures/${row.id}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Consulter la facture"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                {row.status === "draft" ? (
                  <Link
                    href={`/facturation/factures/${row.id}/edit`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    title="Modifier la facture"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link
                  href={`/facturation/factures/${row.id}/print`}
                  target="_blank"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Imprimer / PDF"
                >
                  <Printer className="h-4 w-4" />
                </Link>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
