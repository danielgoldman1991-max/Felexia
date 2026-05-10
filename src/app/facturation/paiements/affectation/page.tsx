import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { createCustomerPayment } from "@/lib/payment-actions";
import { getCustomerAllocationWorkspace, listPaymentCustomers } from "@/lib/payments";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function GlobalPaymentAllocationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const customers = await listPaymentCustomers();
  const workspace = params.customerId ? await getCustomerAllocationWorkspace(params.customerId) : null;
  return (
    <ModulePage>
      <PageHeader title="Affectation paiements" description="Lettrage commercial entre paiements disponibles et factures ouvertes." />
      {params.customerId && workspace ? (
        <CustomerPaymentForm action={createCustomerPayment} customers={customers} invoices={workspace.invoices} initialCustomerId={params.customerId} />
      ) : (
        <EmptyState title="Selection client requise" description="Ouvrez un paiement disponible ou creez un nouveau paiement pour affecter des factures." />
      )}
    </ModulePage>
  );
}
