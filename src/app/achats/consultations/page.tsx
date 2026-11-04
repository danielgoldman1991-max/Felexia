import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchaseRfqsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_rfqs").select("id, rfq_number, title, status, due_date").eq("organization_id", workspace.organization.id).is("archived_at", null).order("created_at", { ascending: false }).limit(100);
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Consultations fournisseurs" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  return (
    <ModulePage>
      <PageHeader title="Consultations fournisseurs" description="Comparez les offres reçues. La moins-disante TTC est recommandée, puis le délai le plus court." actions={<Button asChild><Link href="/achats/consultations/new">Nouvelle consultation</Link></Button>} />
      <Table>
        <thead><tr><Th>Numéro</Th><Th>Objet</Th><Th>Réponse le</Th><Th>Statut</Th></tr></thead>
        <tbody>
          {(data ?? []).length === 0 ? <tr><Td colSpan={4}>Aucune consultation.</Td></tr> : data?.map((row) => (
            <tr key={row.id}><Td><Link className="font-medium text-[var(--primary)]" href={`/achats/consultations/${row.id}`}>{row.rfq_number}</Link></Td><Td>{row.title}</Td><Td>{row.due_date ?? "—"}</Td><Td>{row.status}</Td></tr>
          ))}
        </tbody>
      </Table>
    </ModulePage>
  );
}
