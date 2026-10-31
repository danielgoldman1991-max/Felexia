import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { ListPagination } from "@/components/erp/list-pagination";
import { InvoiceListFilters } from "@/components/invoices/invoice-list-filters";
import { SupplierInvoicesTable } from "@/components/purchases/purchase-documents-table";
import { listSupplierInvoices } from "@/lib/purchases";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const canWrite = !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
  let result;
  try { result = await listSupplierInvoices({ query: params.q, status: params.status, paymentStatus: params.paymentStatus, dateFrom: params.dateFrom, dateTo: params.dateTo, page: Number(params.page || 1) }); }
  catch { return <ModulePage><PageHeader title="Factures fournisseurs" /><EmptyState title="Impossible de charger les factures" description="Réessayez dans un instant. Vos données sont conservées ; contactez l’assistance si le problème persiste." /></ModulePage>; }
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return <ModulePage>
    <PageHeader title="Factures fournisseurs" description="Enregistrez vos factures d’achat et suivez les sommes à régler." actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><a href={`/api/exports/purchases?${query}`}><Download className="h-4 w-4" />Exporter CSV</a></Button>{canWrite ? <Button asChild><Link href="/achats/factures/new"><Plus className="h-4 w-4" />Nouvelle facture</Link></Button> : null}</div>} />
    <InvoiceListFilters params={params} supplier />
    <SupplierInvoicesTable rows={result.rows} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.total} params={params} />
  </ModulePage>;
}
