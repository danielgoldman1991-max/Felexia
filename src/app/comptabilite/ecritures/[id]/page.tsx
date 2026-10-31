import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EntryDetailView } from "@/components/accounting/entry-detail";
import { getAccountingEntryDocumentFlow, listActiveChartOfAccounts } from "@/lib/accounting";
import { getAccountingEntry } from "@/lib/accounting-actions";
import { postAccountingEntry, updateAccountingEntryLineAccount } from "@/lib/accounting-actions";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const canManage = !isOperatorRole(workspace.role) && !isReadOnlyRole(workspace.role);
  const fullAccess = !isOperatorRole(workspace.role) && await hasFullErpAccess(workspace.organization.id);
  const result = await getAccountingEntry(id);
  const detail = result.success && result.data
    ? result.data as import("@/lib/accounting-types").AccountingEntryDetail
    : { entry: null, lines: [] };
  const [accounts, documentFlow] = await Promise.all([
    listActiveChartOfAccounts(),
    getAccountingEntryDocumentFlow(id),
  ]);

  return (
    <ModulePage>
      <PageHeader title="Ecriture comptable" description="Detail de l'ecriture et lignes associees." />
      <EntryDetailView
        fullAccess={fullAccess}
        canManage={canManage}
        detail={detail}
        postAction={postAccountingEntry}
        updateLineAccountAction={updateAccountingEntryLineAccount}
        accounts={accounts}
        documentFlow={documentFlow}
      />
    </ModulePage>
  );
}
