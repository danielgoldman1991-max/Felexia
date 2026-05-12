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
      <PageHeader title="Import releve bancaire" description="Importez un CSV bancaire sans creer de mouvement interne automatiquement." />
      <BankStatementImportForm accounts={accounts} />
    </ModulePage>
  );
}
