import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { createCustomerPayment } from "@/lib/payment-actions";
import { getCustomerOpenItems, listPaymentCustomers } from "@/lib/payments";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewCustomerPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const customers = await listPaymentCustomers();
  const initialOpenItems = params.customerId ? await getCustomerOpenItems(params.customerId) : null;
  return (
    <ModulePage>
      <PageHeader title="Nouveau paiement" description="Creer un reglement client, meme sans facture." />
      <CustomerPaymentForm action={createCustomerPayment} customers={customers} initialOpenItems={initialOpenItems} initialCustomerId={params.customerId ?? ""} />
    </ModulePage>
  );
}
