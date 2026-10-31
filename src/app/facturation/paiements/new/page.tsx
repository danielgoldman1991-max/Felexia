import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { createCustomerPayment } from "@/lib/payment-actions";
import { getCustomerOpenItems, listPaymentCustomers } from "@/lib/payments";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewCustomerPaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  await getDefaultTreasuryAccountId();
  const [customers, treasuryAccounts] = await Promise.all([listPaymentCustomers(), listActiveTreasuryAccounts()]);
  const initialOpenItems = params.customerId ? await getCustomerOpenItems(params.customerId) : null;
  return (
    <ModulePage>
      <PageHeader title="Nouveau règlement client" description="Choisissez le client et les factures à régler, puis indiquez le montant reçu." />
      <CustomerPaymentForm fullAccess={fullAccess} action={createCustomerPayment} customers={customers} treasuryAccounts={treasuryAccounts} initialOpenItems={initialOpenItems} initialCustomerId={params.customerId ?? ""} />
    </ModulePage>
  );
}
