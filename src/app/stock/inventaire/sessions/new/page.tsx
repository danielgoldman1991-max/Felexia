import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { InventorySessionForm } from "@/app/stock/inventaire/sessions/new/form";

export const dynamic = "force-dynamic";

export default async function NewInventorySessionPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const warehouses = await supabase.from("warehouses").select("id, name").eq("organization_id", workspace.organization.id).eq("status", "active").is("archived_at", null).order("name");
  return (
    <ModulePage>
      <PageHeader title="Nouvelle session d’inventaire" description="Le stock théorique de l’emplacement est recopié sur la feuille de comptage." />
      <InventorySessionForm warehouses={warehouses.data ?? []} />
    </ModulePage>
  );
}
