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
      <form method="get" className="flex max-w-md items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="flex-1 space-y-2 text-sm">
          <span className="font-medium">Compte</span>
          <select name="accountId" defaultValue={workspace.selectedAccountId} className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
            {workspace.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <Button type="submit">Afficher</Button>
      </form>
      <ExpertReconciliationPanel view={expert} />
      <ReconciliationWorkspace {...workspace} hideLegacyAuto suggestions={[]} />
    </ModulePage>
  );
}
