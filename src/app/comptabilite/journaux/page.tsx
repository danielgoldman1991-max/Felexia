import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { JournalsTable } from "@/components/accounting/journals-table";
import { ensureAccountingBaseSetup, listAccountingJournalsWithStats } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";

export default async function JournalsPage() {
  const workspace = await requireActiveWorkspace();
  await ensureAccountingBaseSetup(workspace.organization.id);

  const journals = await listAccountingJournalsWithStats();

  return (
    <ModulePage>
      <PageHeader
        title="Journaux"
        description="Journaux comptables de vente, achat, banque et operations diverses."
      />
      <JournalsTable rows={journals} />
    </ModulePage>
  );
}
