import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { RECONCILIATION_STATUS_LABELS, type BankStatementLineRecord } from "@/lib/treasury-types";

export function BankStatementLinesTable({ rows }: { rows: BankStatementLineRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucune ligne bancaire." description="Les lignes importees du releve apparaitront ici." />;
  return (
    <Table>
      <thead><tr><Th>Date</Th><Th>Valeur</Th><Th>Libelle</Th><Th>Reference</Th><Th>Sens</Th><Th>Montant</Th><Th>Solde</Th><Th>Statut</Th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.operation_date}</Td>
            <Td>{row.value_date ?? "-"}</Td>
            <Td>{row.label}</Td>
            <Td>{row.reference ?? "-"}</Td>
            <Td><Badge tone={row.direction === "in" ? "success" : "warning"}>{row.direction === "in" ? "Credit" : "Debit"}</Badge></Td>
            <Td><MoneyDisplay value={row.amount} /></Td>
            <Td>{row.balance_after === null ? "-" : <MoneyDisplay value={row.balance_after} />}</Td>
            <Td><Badge tone={row.reconciliation_status === "reconciled" ? "success" : "neutral"}>{RECONCILIATION_STATUS_LABELS[row.reconciliation_status]}</Badge></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
