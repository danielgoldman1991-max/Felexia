import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierOrderDetail } from "@/components/purchases/supplier-order-detail";
import { getPurchaseDocumentDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_order") notFound();
  return (
    <ModulePage>
      <SupplierOrderDetail document={document} lines={lines} />
    </ModulePage>
  );
}
