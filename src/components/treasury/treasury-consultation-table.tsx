import Link from "next/link";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { RECONCILIATION_STATUS_LABELS, TREASURY_TRANSACTION_TYPE_LABELS, TREASURY_ACCOUNT_TYPE_LABELS, type TreasuryConsultationRow } from "@/lib/treasury-types";

function AccountingStatusBadge({ status }: { status: string }) {
  if (status === "posted") return <Badge tone="success">Comptabilise</Badge>;
  if (status === "not_posted") return <Badge tone="warning">Non comptabilise</Badge>;
  return <Badge tone="neutral">Sans ecriture</Badge>;
}

export function TreasuryConsultationTable({ rows }: { rows: TreasuryConsultationRow[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun flux trouve." description="Essayez de modifier les filtres pour elargir la recherche." />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Compte</Th>
            <Th>Type compte</Th>
            <Th>Flux</Th>
            <Th>Sens</Th>
            <Th>Tiers</Th>
            <Th>Libelle</Th>
            <Th>Reference</Th>
            <Th>Facture</Th>
            <Th>Montant</Th>
            <Th>Paiement</Th>
            <Th>Rapprochement</Th>
            <Th>Comptable</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="whitespace-nowrap">{row.transaction_date}</Td>
              <Td className="whitespace-nowrap">{row.account_name ?? "-"}</Td>
              <Td><Badge tone="neutral">{row.account_type ? TREASURY_ACCOUNT_TYPE_LABELS[row.account_type as keyof typeof TREASURY_ACCOUNT_TYPE_LABELS] ?? row.account_type : "-"}</Badge></Td>
              <Td className="whitespace-nowrap">{TREASURY_TRANSACTION_TYPE_LABELS[row.transaction_type]}</Td>
              <Td><Badge tone={row.direction === "in" ? "success" : "warning"}>{row.direction === "in" ? "Entree" : "Sortie"}</Badge></Td>
              <Td className="whitespace-nowrap">{row.third_party_name ?? "-"}</Td>
              <Td className="max-w-[200px] truncate"><Link href={`/tresorerie/mouvements/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.label}</Link></Td>
              <Td className="whitespace-nowrap">{row.reference ?? "-"}</Td>
              <Td className="whitespace-nowrap">
                {row.customer_invoice_number && <Link href={`/factures/${row.customer_invoice_id}`} className="text-indigo-700 hover:underline">{row.customer_invoice_number}</Link>}
                {row.supplier_invoice_number && <Link href={`/achats/factures/${row.supplier_invoice_id}`} className="text-indigo-700 hover:underline">{row.supplier_invoice_number}</Link>}
                {!row.customer_invoice_number && !row.supplier_invoice_number && "-"}
              </Td>
              <Td className="whitespace-nowrap font-mono tabular-nums"><MoneyDisplay value={row.amount} /></Td>
              <Td className="whitespace-nowrap">{row.payment_method ?? "-"}</Td>
              <Td className="whitespace-nowrap"><Badge tone={row.reconciliation_status === "reconciled" ? "success" : "neutral"}>{RECONCILIATION_STATUS_LABELS[row.reconciliation_status]}</Badge></Td>
              <Td className="whitespace-nowrap">
                {row.accounting_entry_id ? (
                  <Link href={`/comptabilite/ecritures/${row.accounting_entry_id}`} className="text-indigo-700 hover:underline">
                    <AccountingStatusBadge status={row.accounting_status} />
                  </Link>
                ) : (
                  <AccountingStatusBadge status={row.accounting_status} />
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}