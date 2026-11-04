import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function InventorySessionsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_counts").select("id, count_number, counted_on, status, validated_at, warehouse_id").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false });
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Inventaire physique" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  return (
    <ModulePage>
      <PageHeader title="Inventaire physique" description="Une session fige le stock théorique, recueille le comptage, puis génère les ajustements à la validation." actions={<Button asChild><Link href="/stock/inventaire/sessions/new">Nouvelle session</Link></Button>} />
      {(data ?? []).length === 0 ? <EmptyState title="Aucune session d’inventaire" description="Ouvrez une session par emplacement pour compter le stock et historiser les écarts." /> : (
        <Table>
          <thead><tr><Th>Session</Th><Th>Date</Th><Th>Statut</Th><Th>Validée le</Th></tr></thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id as string}>
                <Td><Link className="font-medium text-[var(--primary)]" href={`/stock/inventaire/sessions/${row.id}`}>{row.count_number as string}</Link></Td>
                <Td>{row.counted_on as string}</Td>
                <Td>{row.status === "validated" ? "Validée" : "Brouillon"}</Td>
                <Td>{(row.validated_at as string | null)?.slice(0, 10) ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
