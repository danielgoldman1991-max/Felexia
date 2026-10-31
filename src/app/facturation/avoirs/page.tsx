import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerCreditNotesTable } from "@/components/credit-notes/customer-credit-notes-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listCustomerCreditNotes } from "@/lib/credit-notes";
import { pageRows, searchText } from "@/lib/listing";
import { ListPagination } from "@/components/erp/list-pagination";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";
import { EmptyState } from "@/components/erp/empty-state";

export const dynamic = "force-dynamic";

export default async function CustomerCreditNotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const canWrite = !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
  let rows;
  try { rows = await listCustomerCreditNotes(); }
  catch { return <ModulePage><PageHeader title="Avoirs clients" /><EmptyState title="Impossible de charger les avoirs" description="Réessayez dans un instant ou contactez l’assistance." /></ModulePage>; }
  const needle = searchText(params.q);
  const result = pageRows(rows.filter((row) => (!needle || `${row.credit_note_number} ${row.customer_name ?? ""}`.toLocaleLowerCase("fr").includes(needle)) && (!params.status || row.status === params.status)), Number(params.page || 1), 25);
  return (
    <ModulePage>
      <PageHeader
        title="Avoirs clients"
        description="Corrigez une facture et suivez les crédits disponibles de vos clients."
        actions={canWrite ? <Button asChild><Link href="/facturation/avoirs/new">Nouvel avoir</Link></Button> : undefined}
      />
      <form method="get" className="mb-4 flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <input name="q" aria-label="Rechercher un avoir" placeholder="Numéro ou client" defaultValue={params.q} className="min-w-48 flex-1 rounded-lg border border-[var(--border)] px-3 py-2" />
        <select name="status" aria-label="Statut de l’avoir" defaultValue={params.status || ""} className="rounded-lg border border-[var(--border)] px-3 py-2"><option value="">Tous les statuts</option><option value="draft">Brouillon</option><option value="validated">Validé</option><option value="partially_applied">Partiellement affecté</option><option value="applied">Affecté</option><option value="cancelled">Annulé</option></select>
        <Button type="submit" variant="secondary">Rechercher</Button>
      </form>
      <Card><CardContent><CustomerCreditNotesTable rows={result.rows} canWrite={canWrite} /></CardContent></Card>
      <ListPagination page={result.page} totalPages={result.totalPages} total={result.total} params={params} />
    </ModulePage>
  );
}
