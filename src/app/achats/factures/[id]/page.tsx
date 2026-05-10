import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceDetail } from "@/components/purchases/supplier-invoice-detail";
import { getSupplierInvoiceDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getSupplierInvoiceDetail(id);
  if (!invoice) notFound();
  return (
    <ModulePage>
      <SupplierInvoiceDetail invoice={invoice} lines={lines} />
    </ModulePage>
  );
}
