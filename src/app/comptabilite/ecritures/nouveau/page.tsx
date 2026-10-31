import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EntryForm } from "@/components/accounting/entry-form";
import { createAccountingEntry } from "@/lib/accounting-actions";
import { listAccountingJournals, listAccountingAccounts } from "@/lib/accounting-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ journalId?: string }> }) {
  const params = await searchParams;
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
        actions={<Button variant="secondary" asChild><Link href="/comptabilite/journaux">Retour aux journaux</Link></Button>}
      />
      <EntryForm
        action={createAccountingEntry}
        journals={journals}
        accounts={accounts}
        initialJournalId={journals.some((journal) => journal.id === params.journalId) ? params.journalId : undefined}
      />
    </ModulePage>
  );
}
