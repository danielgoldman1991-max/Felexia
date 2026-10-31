import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { JournalsTable } from "@/components/accounting/journals-table";
import { ensureAccountingBaseSetup, listAccountingJournalsWithStats } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function JournalsPage() {
  const workspace = await requireActiveWorkspace();
  await ensureAccountingBaseSetup(workspace.organization.id);

  const journals = await listAccountingJournalsWithStats();

  return (
    <ModulePage>
      <PageHeader
        title="Journaux"
        description="Journaux comptables de vente, achat, banque et operations diverses."
        actions={<><Button variant="secondary" asChild><Link href="/comptabilite/ecritures">Toutes les écritures</Link></Button><Button asChild><Link href="/comptabilite/ecritures/nouveau">Nouvelle écriture</Link></Button></>}
      />
      <JournalsTable rows={journals} />
    </ModulePage>
  );
}
