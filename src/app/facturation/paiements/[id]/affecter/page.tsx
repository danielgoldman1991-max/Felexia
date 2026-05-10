import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { PaymentAllocationForm } from "@/components/payments/payment-allocation-form";
import { getPaymentAllocationPreparation } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function AllocateCustomerPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, invoices } = await getPaymentAllocationPreparation(id);
  if (!payment || payment.status === "cancelled") notFound();
  return (
    <ModulePage>
      <PageHeader title="Affecter le paiement" description={payment.payment_number} />
      <PaymentAllocationForm payment={payment} invoices={invoices} />
    </ModulePage>
  );
}
