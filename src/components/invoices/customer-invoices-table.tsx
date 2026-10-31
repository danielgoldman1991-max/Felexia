import Link from "next/link";
import { Eye, Pencil, Printer, ReceiptText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatDate } from "@/lib/format";
import type { CustomerInvoiceRecord } from "@/lib/invoice-types";

const paymentLabels: Record<CustomerInvoiceRecord["payment_status"], string> = {
  unpaid: "Non réglée",
  partial: "Partiellement réglée",
  paid: "Réglée",
};

const accountingLabels: Record<NonNullable<CustomerInvoiceRecord["accounting_status"]>, string> = {
  posted: "Comptabilisée",
  not_posted: "Non comptabilisée",
  pending_validation: "À valider d’abord",
  not_applicable: "Non applicable",
};

function AccountingSummary({ invoice }: { invoice: CustomerInvoiceRecord }) {
  const status = invoice.accounting_status ?? "not_posted";
  const label = accountingLabels[status];
  if (status === "posted" && invoice.accounting_entry_id) {
    return <Link href={`/comptabilite/ecritures/${invoice.accounting_entry_id}`} title={`${label}${invoice.accounting_entry_number ? ` · ${invoice.accounting_entry_number}` : ""}`} className="block max-w-44 truncate text-xs text-[var(--primary)] hover:underline">{label}{invoice.accounting_entry_number ? ` · ${invoice.accounting_entry_number}` : ""}</Link>;
  }
  return <p className="text-xs text-[var(--muted)]">{label}</p>;
}

export function CustomerInvoicesTable({ rows, filtered = false }: { rows: CustomerInvoiceRecord[]; filtered?: boolean }) {
  if (rows.length === 0) {
    return <EmptyState title={filtered ? "Aucune facture ne correspond" : "Aucune facture de vente pour le moment"} description={filtered ? "Modifiez votre recherche ou réinitialisez les filtres pour retrouver vos factures." : "Créez votre première facture pour facturer un client et suivre son règlement."} icon={filtered ? <SearchX className="h-6 w-6" /> : <ReceiptText className="h-6 w-6" />} action={filtered ? <Button variant="secondary" asChild><Link href="/facturation/factures">Réinitialiser les filtres</Link></Button> : undefined} />;
  }

  return (
    <Table className="[&_th]:px-3 [&_td]:px-3">
      <thead>
        <tr>
          <Th>Numéro</Th><Th>Client</Th><Th>Date</Th><Th>Statut</Th><Th className="text-right">Total TTC</Th><Th className="text-right" title="Reste à régler">Reste</Th><Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link
                href={`/facturation/factures/${row.id}`}
                className="font-semibold text-[var(--primary)] hover:underline"
              >
                {row.invoice_number}
              </Link>
            </Td>
            <Td><span className="block max-w-40 truncate" title={row.customer_name ?? undefined}>{row.customer_name ?? "—"}</span></Td>
            <Td>
              <p className="whitespace-nowrap">{formatDate(row.invoice_date)}</p>
              <p className="mt-1 whitespace-nowrap text-xs text-[var(--muted)]">Éch. {row.due_date ? formatDate(row.due_date) : "—"}</p>
            </Td>
            <Td>
              <div className="space-y-1">
                <InvoiceStatusBadge status={row.status} />
                <p className="text-xs text-[var(--muted)]">{paymentLabels[row.payment_status]}</p>
                <AccountingSummary invoice={row} />
              </div>
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums">
              <p className="font-semibold"><MoneyDisplay value={row.total_ttc} /></p>
              <p className="mt-1 text-xs text-[var(--muted)]">Réglé <MoneyDisplay value={row.paid_amount} /></p>
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums"><MoneyDisplay value={row.remaining_amount} /></Td>
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
