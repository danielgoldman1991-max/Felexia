import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceForm } from "@/components/purchases/supplier-invoice-form";
import { listPurchaseSuppliers, listPurchaseProducts, listBillableSupplierReceipts } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function NewSupplierInvoicePage() {
  const [suppliers, products, billableReceipts] = await Promise.all([listPurchaseSuppliers(), listPurchaseProducts(), listBillableSupplierReceipts()]);
  return (
    <ModulePage>
      <SupplierInvoiceForm suppliers={suppliers} products={products} billableReceipts={billableReceipts} />
    </ModulePage>
  );
}
