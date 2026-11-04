import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ExpertReconciliationPanel } from "@/components/treasury/expert-reconciliation-panel";
import { ReconciliationWorkspace } from "@/components/treasury/reconciliation-workspace";
import { Button } from "@/components/ui/button";
import { getReconciliationWorkspace } from "@/lib/treasury";
import { loadExpertReconciliation } from "@/lib/treasury/reconciliation-view";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const params = await searchParams;
  const [workspace, expert] = await Promise.all([
    getReconciliationWorkspace(params.accountId),
    loadExpertReconciliation(params.accountId),
  ]);
  return (
    <ModulePage>
      <PageHeader
        title="Rapprochement bancaire"
        description="Comparez le relevé et les mouvements, validez les propositions et annulez si besoin."
        actions={<Button variant="secondary" asChild><Link href="/tresorerie/releves/import">Importer un relevé</Link></Button>}
      />
      <ExpertReconciliationPanel view={expert} />
      <ReconciliationWorkspace {...workspace} hideLegacyAuto suggestions={[]} />
    </ModulePage>
  );
}
