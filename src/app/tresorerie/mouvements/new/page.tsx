import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryTransactionForm } from "@/components/treasury/treasury-transaction-form";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function NewTreasuryTransactionPage() {
  await getDefaultTreasuryAccountId();
  const accounts = await listActiveTreasuryAccounts();
  return (
    <ModulePage>
      <PageHeader title="Nouveau mouvement" description="Saisissez une entree ou une sortie manuelle de tresorerie." />
      <TreasuryTransactionForm accounts={accounts} />
    </ModulePage>
  );
}
