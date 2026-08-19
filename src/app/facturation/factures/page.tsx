import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        description="Liste des factures, statuts de validation et paiements."
        actions={<Button asChild><Link href="/facturation/factures/new">Nouvelle facture</Link></Button>}
      />
      <Card>
        <CardContent>
          <CustomerInvoicesTable rows={rows} />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
