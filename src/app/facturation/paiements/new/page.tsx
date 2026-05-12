import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { createCustomerPayment } from "@/lib/payment-actions";
import { getCustomerOpenItems, listPaymentCustomers } from "@/lib/payments";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewCustomerPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await getDefaultTreasuryAccountId();
  const [customers, treasuryAccounts] = await Promise.all([listPaymentCustomers(), listActiveTreasuryAccounts()]);
  const initialOpenItems = params.customerId ? await getCustomerOpenItems(params.customerId) : null;
  return (
    <ModulePage>
      <PageHeader title="Nouveau paiement" description="Creer un reglement client, meme sans facture." />
      <CustomerPaymentForm action={createCustomerPayment} customers={customers} treasuryAccounts={treasuryAccounts} initialOpenItems={initialOpenItems} initialCustomerId={params.customerId ?? ""} />
    </ModulePage>
  );
}
