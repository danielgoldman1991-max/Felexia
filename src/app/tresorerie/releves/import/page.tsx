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
      <PageHeader title="Import de relevé bancaire" description="CSV, Excel, OFX ou QFX. Les lignes déjà connues sont ignorées. L'import ne crée pas encore le règlement." />
      <BankStatementImportForm accounts={accounts} />
    </ModulePage>
  );
}
