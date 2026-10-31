import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EntriesTable, EntriesSummaryCards } from "@/components/accounting/entries-table";
import { listAccountingEntries } from "@/lib/accounting-actions";
import { requireActiveWorkspace } from "@/lib/auth";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export default async function EntriesPage() {
  const workspace = await requireActiveWorkspace();
  const canWrite = !isOperatorRole(workspace.role) && !isReadOnlyRole(workspace.role);
  const result = await listAccountingEntries({ pageSize: 100 });
  const entries = result.success && result.data
    ? (result.data as { entries: Array<import("@/lib/accounting-types").AccountingEntryRecord>; total: number })
    : { entries: [], total: 0 };

  return (
    <ModulePage>
      <PageHeader
        title="Ecritures comptables"
        description="Ecritures generees ou saisies manuellement."
        actions={<><Button variant="secondary" asChild><Link href="/comptabilite/journaux">Journaux</Link></Button>{canWrite ? <Button asChild><Link href="/comptabilite/ecritures/nouveau">Nouvelle écriture</Link></Button> : null}</>}
      />
      <div className="space-y-6">
        <EntriesSummaryCards entries={entries.entries} />
        <EntriesTable rows={entries.entries} />
        {entries.total > 100 ? (
          <p className="text-center text-xs text-[var(--muted)]">
            Affichage des 100 dernieres ecritures sur {entries.total} au total.
          </p>
        ) : null}
      </div>
    </ModulePage>
  );
}
