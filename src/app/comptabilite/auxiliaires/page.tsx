import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/erp/empty-state";
import { listAccountingAuxiliaries } from "@/lib/accounting-actions";
import { AUXILIARY_TYPE_LABELS } from "@/lib/accounting-types";

export default async function AuxiliariesPage() {
  const result = await listAccountingAuxiliaries();
  const auxiliaries = result.success && result.data
    ? result.data as import("@/lib/accounting-types").AccountingAuxiliaryRecord[]
    : [];

  return (
    <ModulePage>
      <PageHeader title="Auxiliaires" description="Tiers comptables rattaches aux comptes de tiers." />
      {auxiliaries.length === 0 ? (
        <EmptyState title="Aucun auxiliaire" description="Les auxiliaires sont generes automatiquement depuis les clients et fournisseurs." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th><Th>Nom</Th><Th>Type</Th><Th>Compte general</Th><Th>ICE</Th><Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {auxiliaries.map((row) => (
              <tr key={row.id}>
                <Td><span className="font-mono text-sm font-medium">{row.code}</span></Td>
                <Td>{row.name}</Td>
                <Td><Badge tone="info">{AUXILIARY_TYPE_LABELS[row.type] ?? row.type}</Badge></Td>
                <Td><span className="font-mono text-xs">{row.general_account_code}</span></Td>
                <Td className="text-xs text-[var(--muted)]">{row.ice ?? "-"}</Td>
                <Td><Badge tone={row.is_active ? "success" : "danger"}>{row.is_active ? "Actif" : "Inactif"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
