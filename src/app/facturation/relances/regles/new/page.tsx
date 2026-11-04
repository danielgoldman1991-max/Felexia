import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { ReminderRuleForm } from "@/app/facturation/relances/regles/form";

export const dynamic = "force-dynamic";

export default async function NewReminderRulePage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  return (
    <ModulePage>
      <PageHeader title="Nouvelle règle de relance" description="Elle sera proposée dès que le retard atteint le délai indiqué." />
      <ReminderRuleForm />
    </ModulePage>
  );
}
