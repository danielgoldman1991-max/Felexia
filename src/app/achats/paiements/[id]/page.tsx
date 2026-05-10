import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentDetail } from "@/components/purchases/supplier-payment-detail";
import { getSupplierPaymentDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getSupplierPaymentDetail(id);
  if (!payment) notFound();
  return (
    <ModulePage>
      <SupplierPaymentDetail payment={payment} allocations={allocations} />
    </ModulePage>
  );
}
