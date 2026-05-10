import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerPaymentDetail } from "@/components/payments/customer-payment-detail";
import { getCustomerPaymentDetail } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getCustomerPaymentDetail(id);
  if (!payment) notFound();
  return <ModulePage><CustomerPaymentDetail payment={payment} allocations={allocations} /></ModulePage>;
}
