import Link from "next/link";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { RECONCILIATION_STATUS_LABELS, TREASURY_TRANSACTION_TYPE_LABELS, type TreasuryTransactionRecord } from "@/lib/treasury-types";

export function TreasuryTransactionsTable({ rows }: { rows: TreasuryTransactionRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun mouvement de tresorerie." description="Les encaissements, decaissements et mouvements manuels apparaitront ici." />;
  return (
    <Table>
      <thead><tr><Th>Date</Th><Th>Compte</Th><Th>Type</Th><Th>Sens</Th><Th>Tiers</Th><Th>Libelle</Th><Th>Reference</Th><Th>Montant</Th><Th>Rapprochement</Th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.transaction_date}</Td>
            <Td>{row.account_name ?? row.treasury_account_id}</Td>
            <Td>{TREASURY_TRANSACTION_TYPE_LABELS[row.transaction_type]}</Td>
            <Td><Badge tone={row.direction === "in" ? "success" : "warning"}>{row.direction === "in" ? "Entree" : "Sortie"}</Badge></Td>
            <Td>{row.third_party_name ?? "-"}</Td>
            <Td><Link href={`/tresorerie/mouvements/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.label}</Link></Td>
            <Td>{row.reference ?? "-"}</Td>
            <Td><MoneyDisplay value={row.amount} /></Td>
            <Td><Badge tone={row.reconciliation_status === "reconciled" ? "success" : "neutral"}>{RECONCILIATION_STATUS_LABELS[row.reconciliation_status]}</Badge></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
