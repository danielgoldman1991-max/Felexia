import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { CollectionFile } from "@/components/reminders/collection-file";
import { Button } from "@/components/ui/button";
import { loadCollectionDesk } from "@/lib/sales/collection-desk";
import { seedCollectionScenarios } from "@/lib/sales/collection-actions";

export const dynamic = "force-dynamic";

export default async function CollectionFilePage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const desk = await loadCollectionDesk();
  return (
    <ModulePage>
      <PageHeader
        title="Recouvrement"
        description="File du jour, promesses et pauses. Les scénarios se règlent dans les règles de relance."
        actions={(
          <>
            <form action={seedCollectionScenarios}><Button type="submit" variant="secondary">Scénarios usuels</Button></form>
            <Button variant="ghost" asChild><Link href="/facturation/relances/regles">Règles</Link></Button>
          </>
        )}
      />
      <CollectionFile queue={desk.queue} openInvoices={desk.openInvoices} autoSend={desk.autoSend} arabic={desk.arabic} pending={desk.pending} />
    </ModulePage>
  );
}
