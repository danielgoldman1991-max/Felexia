import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ExpertReconciliationPanel } from "@/components/treasury/expert-reconciliation-panel";
import { ManualReconciliationForm } from "@/components/treasury/manual-reconciliation-form";
import { ReconciliationWorkspace } from "@/components/treasury/reconciliation-workspace";
import { ReconciliationAccountFilter } from "@/components/treasury/reconciliation-account-filter";
import { Button } from "@/components/ui/button";
import { getReconciliationWorkspace } from "@/lib/treasury";
import { loadManualMatchBoard } from "@/lib/treasury/manual-match-data";
import { loadExpertReconciliation } from "@/lib/treasury/reconciliation-view";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const params = await searchParams;
  const [workspace, expert, preparedManual] = await Promise.all([
    getReconciliationWorkspace(params.accountId),
    loadExpertReconciliation(params.accountId),
    params.accountId ? loadManualMatchBoard(params.accountId) : Promise.resolve(null),
  ]);
  const manual = preparedManual ?? await loadManualMatchBoard(expert.accountId || workspace.selectedAccountId);
  return (
    <ModulePage>
      <PageHeader
        title="Rapprochement bancaire"
        description="Comparez le relevé et les pièces, validez les propositions, rapprochez plusieurs lignes à la main et annulez si besoin."
        actions={<Button variant="secondary" asChild><Link href="/tresorerie/releves/import">Importer un relevé</Link></Button>}
      />
      <ReconciliationAccountFilter accounts={workspace.accounts.map((account) => ({ id: account.id, name: account.name }))} selectedAccountId={workspace.selectedAccountId} />
      <ExpertReconciliationPanel view={expert} />
      <ManualReconciliationForm board={manual} />
      <ReconciliationWorkspace {...workspace} hideLegacyAuto suggestions={[]} />
    </ModulePage>
  );
}
