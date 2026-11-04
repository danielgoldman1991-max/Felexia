import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { BankStatementImportForm } from "@/components/treasury/bank-statement-import-form";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function ImportBankStatementPage() {
  await getDefaultTreasuryAccountId();
  const accounts = await listActiveTreasuryAccounts();
  return (
    <ModulePage>
      <PageHeader title="Import de relevé bancaire" description="CSV, OFX ou QFX. L'import ne crée pas de mouvement interne." />
      <BankStatementImportForm accounts={accounts} />
    </ModulePage>
  );
}
