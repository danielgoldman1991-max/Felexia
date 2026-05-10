import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierOrderForm } from "@/components/purchases/supplier-order-form";
import { getPurchaseDocumentDetail, listPurchaseSuppliers, listPurchaseProducts } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function EditSupplierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, suppliers, products] = await Promise.all([getPurchaseDocumentDetail(id), listPurchaseSuppliers(), listPurchaseProducts()]);
  if (!result.document || result.document.document_type !== "supplier_order") notFound();
  return (
    <ModulePage>
      <SupplierOrderForm suppliers={suppliers} products={products} document={result.document} lines={result.lines} />
    </ModulePage>
  );
}
