import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EntriesTable, EntriesSummaryCards } from "@/components/accounting/entries-table";
import { listAccountingEntries, listPendingAccountingDocuments } from "@/lib/accounting-actions";
import { PendingPostPanel } from "@/app/comptabilite/ecritures/pending-post";
import { requireActiveWorkspace } from "@/lib/auth";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export default async function EntriesPage() {
  const workspace = await requireActiveWorkspace();
  const canWrite = !isOperatorRole(workspace.role) && !isReadOnlyRole(workspace.role);
  const [result, pendingDocuments] = await Promise.all([
    listAccountingEntries({ pageSize: 100 }),
    canWrite ? listPendingAccountingDocuments().catch(() => []) : Promise.resolve([]),
  ]);
  const entries = result.success && result.data
    ? (result.data as { entries: Array<import("@/lib/accounting-types").AccountingEntryRecord>; total: number })
    : { entries: [], total: 0 };

  return (
    <ModulePage>
      <PageHeader
        title="Écritures comptables"
        description="Écritures générées ou saisies manuellement. Le numéro suit le mois de la date, dans l'ordre de comptabilisation : le FEC les reclasse par date."
        actions={<><Button variant="secondary" asChild><Link href="/comptabilite/journaux">Journaux</Link></Button>{canWrite ? <Button asChild><Link href="/comptabilite/ecritures/nouveau">Nouvelle écriture</Link></Button> : null}</>}
      />
      <div className="space-y-6">
        {canWrite ? <PendingPostPanel documents={pendingDocuments} /> : null}
        <EntriesSummaryCards entries={entries.entries} />
        <EntriesTable rows={entries.entries} />
        {entries.total > 100 ? (
          <p className="text-center text-xs text-[var(--muted)]">
            Affichage des 100 dernieres écritures sur {entries.total} au total.
          </p>
        ) : null}
      </div>
    </ModulePage>
  );
}
