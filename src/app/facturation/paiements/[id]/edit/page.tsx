import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { updateCustomerPayment } from "@/lib/payment-actions";
import { getCustomerPaymentDetail, listPaymentCustomers } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function EditCustomerPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ payment }, customers] = await Promise.all([getCustomerPaymentDetail(id), listPaymentCustomers()]);
  if (!payment || payment.allocated_amount > 0 || payment.status === "cancelled") notFound();
  return (
    <ModulePage>
      <PageHeader title="Modifier paiement" description={payment.payment_number} />
      <CustomerPaymentForm
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
