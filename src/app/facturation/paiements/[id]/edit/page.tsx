import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { updateCustomerPayment } from "@/lib/payment-actions";
import { getCustomerPaymentDetail, listPaymentCustomers } from "@/lib/payments";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function EditCustomerPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const [{ payment }, customers, treasuryAccounts] = await Promise.all([getCustomerPaymentDetail(id), listPaymentCustomers(), listActiveTreasuryAccounts()]);
  if (!payment || payment.allocated_amount > 0 || payment.status === "cancelled") notFound();
  return (
    <ModulePage>
      <PageHeader title="Modifier paiement" description={payment.payment_number} />
      <CustomerPaymentForm
        fullAccess={fullAccess}
        treasuryAccounts={treasuryAccounts}
        action={updateCustomerPayment}
        customers={customers}
        initialCustomerId={payment.third_party_id}
        paymentId={payment.id}
        initialValues={payment}
        submitLabel="Enregistrer"
      />
    </ModulePage>
  );
}
