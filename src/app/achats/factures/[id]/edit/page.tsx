import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceForm } from "@/components/purchases/supplier-invoice-form";
import { getSupplierInvoiceDetail, listPurchaseSuppliers, listPurchaseProducts } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function EditSupplierInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, suppliers, products] = await Promise.all([getSupplierInvoiceDetail(id), listPurchaseSuppliers(), listPurchaseProducts()]);
  if (!result.invoice) notFound();
  return (
    <ModulePage>
      <SupplierInvoiceForm suppliers={suppliers} products={products} invoice={result.invoice} lines={result.lines} />
    </ModulePage>
  );
}
