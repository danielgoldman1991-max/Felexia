import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EntryForm } from "@/components/accounting/entry-form";
import { createAccountingEntry } from "@/lib/accounting-actions";
import { listAccountingJournals, listAccountingAccounts } from "@/lib/accounting-actions";

export default async function NewEntryPage() {
  const [journalsResult, accountsResult] = await Promise.all([
    listAccountingJournals(),
    listAccountingAccounts(),
  ]);

  const journals = journalsResult.success && journalsResult.data
    ? journalsResult.data as import("@/lib/accounting-types").AccountingJournalRecord[]
    : [];
  const accounts = accountsResult.success && accountsResult.data
    ? accountsResult.data as import("@/lib/accounting-types").AccountingAccountRecord[]
    : [];

  return (
    <ModulePage>
      <PageHeader
        title="Nouvelle ecriture"
        description="Saisie manuelle d'une ecriture comptable."
      />
      <EntryForm
        action={createAccountingEntry}
        journals={journals}
        accounts={accounts}
      />
    </ModulePage>
  );
}
