import Link from "next/link";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CustomerInvoicesTable } from "@/components/invoices/customer-invoices-table";
import { listCustomerInvoices } from "@/lib/invoices";
import type { CustomerInvoicePaymentStatus, CustomerInvoiceStatus } from "@/lib/invoice-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: CustomerInvoiceStatus | "all";
  paymentStatus?: CustomerInvoicePaymentStatus | "all";
  page?: string;
}>;

export default async function CustomerInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { rows } = await listCustomerInvoices({
    query: params.q,
    status: params.status,
    paymentStatus: params.paymentStatus,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <ModulePage>
      <PageHeader
        title="Factures clients"
        description="Créez vos factures de vente et suivez les règlements de vos clients."
        actions={<Button asChild><Link href="/facturation/factures/new"><Plus className="h-4 w-4" aria-hidden="true" />Nouvelle facture</Link></Button>}
      />
      <form role="search" aria-label="Filtrer les factures clients" className="mb-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
          <Input name="q" defaultValue={params.q} placeholder="Rechercher un numéro de facture…" aria-label="Rechercher un numéro de facture" className="pl-9" />
        </div>
        <Select name="status" defaultValue={params.status ?? "all"} aria-label="Statut de la facture">
          <option value="all">Tous les statuts</option>
          <option value="draft">Brouillons</option>
          <option value="validated">Validées</option>
          <option value="sent">Envoyées</option>
          <option value="partially_paid">Partiellement réglées</option>
          <option value="paid">Payées</option>
          <option value="overdue">En retard</option>
          <option value="cancelled">Annulées</option>
        </Select>
        <Select name="paymentStatus" defaultValue={params.paymentStatus ?? "all"} aria-label="État du règlement">
          <option value="all">Tous les règlements</option>
          <option value="unpaid">Non réglées</option>
          <option value="partial">Règlement partiel</option>
          <option value="paid">Réglées</option>
        </Select>
        <Button type="submit" variant="secondary" className="sm:col-span-2 xl:col-span-1"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Appliquer</Button>
      </form>
      <CustomerInvoicesTable rows={rows} filtered={Boolean(params.q || (params.status && params.status !== "all") || (params.paymentStatus && params.paymentStatus !== "all"))} />
    </ModulePage>
  );
}
