import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TreasuryTransactionsTable } from "@/components/treasury/treasury-transactions-table";
import { listTreasuryAccounts, listTreasuryTransactions } from "@/lib/treasury";
import { ListPagination } from "@/components/erp/list-pagination";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { pageRows, positivePage } from "@/lib/listing";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function TreasuryTransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const workspace = await requireActiveWorkspace();
  const fullAccess = !isOperatorRole(workspace.role) && await hasFullErpAccess(workspace.organization.id);
  const canWrite = !isOperatorRole(workspace.role) && !isReadOnlyRole(workspace.role);
  const [rows, accounts] = await Promise.all([listTreasuryTransactions(filters), listTreasuryAccounts()]);
  const result = pageRows(rows, positivePage(filters.page), 50);
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return (
    <ModulePage>
      <PageHeader
        title="Mouvements de trésorerie"
        description="Consultez et exportez l’ensemble de vos entrées et sorties."
        actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><a href={`/api/exports/treasury?${query}`}><Download className="h-4 w-4" />Exporter CSV</a></Button><Button variant="secondary" asChild><Link href="/tresorerie/consultation">Consultation détaillée</Link></Button>{canWrite ? <Button asChild><Link href="/tresorerie/mouvements/new"><Plus className="h-4 w-4" /> Nouveau mouvement</Link></Button> : null}</div>}
      />
      <form role="search" aria-label="Filtrer les mouvements" className="mb-4 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs font-medium"><span>Libellé ou référence</span><Input name="q" defaultValue={filters.q} /></label>
        <label className="space-y-1 text-xs font-medium"><span>Compte</span><Select name="accountId" defaultValue={filters.accountId || ""}><option value="">Tous les comptes</option>{accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</Select></label>
        <label className="space-y-1 text-xs font-medium"><span>Sens</span><Select name="direction" defaultValue={filters.direction || "all"}><option value="all">Entrées et sorties</option><option value="in">Entrées</option><option value="out">Sorties</option></Select></label>
        <label className="space-y-1 text-xs font-medium"><span>Du</span><Input type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
        <label className="space-y-1 text-xs font-medium"><span>Au</span><Input type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
        <Button type="submit" variant="secondary" className="self-end">Appliquer les filtres</Button>
      </form>
      <Card><CardContent><TreasuryTransactionsTable rows={result.rows} fullAccess={fullAccess} /></CardContent></Card>
      <ListPagination page={result.page} totalPages={result.totalPages} total={result.total} params={filters} />
    </ModulePage>
  );
}
