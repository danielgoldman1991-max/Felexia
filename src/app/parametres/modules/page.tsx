import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { getModulesCatalog } from "@/lib/saas";
import { ModuleAdminClient } from "./client";

export default async function ModulesAdminPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const catalog = await getModulesCatalog();

  const { data: enabledModules } = await supabase
    .from("organization_modules")
    .select("module_key")
    .eq("organization_id", workspace.organization.id)
    .eq("enabled", true);

  const enabledKeys = (enabledModules ?? []).map((m) => m.module_key);
  const freeKeys = catalog.filter((m) => Number(m.monthly_price) === 0).map((m) => m.module_key);

  return (
    <div>
      <PageHeader title="Modules" description="Activez ou désactivez les modules pour votre organisation." />
      <ModuleAdminClient
        modules={catalog}
        enabledKeys={enabledKeys}
        freeKeys={freeKeys}
        organizationId={workspace.organization.id}
      />
    </div>
  );
}
