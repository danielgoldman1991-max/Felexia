import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { JournalCreateForm } from "@/app/comptabilite/journaux/new/form";
import { Button } from "@/components/ui/button";
import { requireProWorkspace } from "@/lib/pro-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function NewAccountingJournalPage() {
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role) || isReadOnlyRole(workspace.role)) {
    return (
      <ModulePage>
        <PageHeader title="Nouveau journal" description="La création d’un journal est réservée à l’administrateur." actions={<Button variant="secondary" asChild><Link href="/comptabilite/journaux">Retour</Link></Button>} />
      </ModulePage>
    );
  }
  const accounts = await listActiveTreasuryAccounts();
  return (
    <ModulePage>
      <PageHeader title="Nouveau journal" description="Ventes, achats, banque, caisse ou opérations diverses. Le code est unique pour l’entreprise." />
      <JournalCreateForm accounts={accounts.map((account) => ({ id: account.id, name: account.name, accountType: account.account_type }))} />
    </ModulePage>
  );
}
