import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ReconciliationWorkspace } from "@/components/treasury/reconciliation-workspace";
import { getReconciliationWorkspace } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage({ searchParams }: { searchParams: Promise<{ accountId?: string; auto?: string }> }) {
  const params = await searchParams;
  const workspace = await getReconciliationWorkspace(params.accountId, { includeSuggestions: params.auto === "1" });
  return (
    <ModulePage>
      <PageHeader title="Rapprochement bancaire" description="Associez les lignes bancaires importees aux mouvements internes." />
      <ReconciliationWorkspace {...workspace} />
    </ModulePage>
  );
}
