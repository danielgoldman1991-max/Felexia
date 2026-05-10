import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentAllocateForm } from "@/components/purchases/supplier-payment-allocate-form";
import { getSupplierPaymentDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function AllocateSupplierPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, openInvoices } = await getSupplierPaymentDetail(id);
  if (!payment) notFound();
  return (
    <ModulePage>
      <SupplierPaymentAllocateForm payment={payment} openInvoices={openInvoices} />
    </ModulePage>
  );
}
