import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { PriceListForm } from "@/app/vente/prix/form";

export const dynamic = "force-dynamic";

export default async function NewPriceListPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const [customers, products] = await Promise.all([
    supabase.from("third_parties").select("id, name").eq("organization_id", workspace.organization.id).is("archived_at", null).order("name").limit(300),
    supabase.from("products").select("id, name").eq("organization_id", workspace.organization.id).is("archived_at", null).order("name").limit(300),
  ]);
  return (
    <ModulePage>
      <PageHeader title="Nouvelle liste de prix" description="Rattachez la liste à un client. La remise s’applique si la ligne n’en a pas déjà une." />
      <PriceListForm customers={customers.data ?? []} products={products.data ?? []} />
    </ModulePage>
  );
}
