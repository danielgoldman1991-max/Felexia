import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchaseRequestsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select("id, request_number, title, status, needed_on")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <ModulePage>
      <PageHeader title="Demandes d'achat" description="Besoins internes avant commande ou consultation." actions={<Button asChild><Link href="/achats/demandes/new">Nouvelle demande</Link></Button>} />
      <Table>
        <thead><tr><Th>Numéro</Th><Th>Objet</Th><Th>Besoin le</Th><Th>Statut</Th></tr></thead>
        <tbody>
          {(data ?? []).length === 0 ? <tr><Td colSpan={4}>Aucune demande.</Td></tr> : data?.map((row) => (
            <tr key={row.id}>
              <Td><Link className="font-medium text-[var(--primary)]" href={`/achats/demandes/${row.id}`}>{row.request_number}</Link></Td>
              <Td>{row.title}</Td>
              <Td>{row.needed_on ?? "—"}</Td>
              <Td>{row.status}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ModulePage>
  );
}
