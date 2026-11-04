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
import { deletePriceListAction } from "@/lib/sales/commercial-terms-actions";

export const dynamic = "force-dynamic";

export default async function PriceListsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_price_lists").select("id, name, discount_percent, active, customer_id").eq("organization_id", workspace.organization.id).order("name");
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Listes de prix" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  const customerIds = Array.from(new Set((data ?? []).map((row) => row.customer_id).filter(Boolean))) as string[];
  const customers = customerIds.length
    ? await supabase.from("third_parties").select("id, name").eq("organization_id", workspace.organization.id).in("id", customerIds)
    : { data: [] };
  const names = new Map((customers.data ?? []).map((row) => [row.id, row.name]));
  return (
    <ModulePage>
      <PageHeader title="Listes de prix et remises" description="Le prix d’article et la remise de la liste active sont appliqués aux devis et aux factures du client." actions={<Button asChild><Link href="/vente/prix/new">Nouvelle liste</Link></Button>} />
      {(data ?? []).length === 0 ? <EmptyState title="Aucune liste de prix" description="Créez une liste pour un client, avec une remise et des prix HT." /> : (
        <Table>
          <thead><tr><Th>Liste</Th><Th>Client</Th><Th className="text-right">Remise</Th><Th>État</Th><Th></Th></tr></thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id as string}>
                <Td><Link className="font-medium text-[var(--primary)]" href={`/vente/prix/${row.id}`}>{row.name as string}</Link></Td>
                <Td>{row.customer_id ? names.get(row.customer_id as string) ?? "Client" : "Non rattachée"}</Td>
                <Td className="text-right">{Number(row.discount_percent ?? 0).toLocaleString("fr-MA")} %</Td>
                <Td>{row.active === false ? "Inactive" : "Active"}</Td>
                <Td>
                  <form action={deletePriceListAction}><input type="hidden" name="id" value={row.id as string} /><Button type="submit" variant="ghost">Supprimer</Button></form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
