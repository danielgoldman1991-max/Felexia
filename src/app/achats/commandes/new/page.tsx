import { ModulePage } from "@/components/erp/module-page";
import { SupplierOrderForm } from "@/components/purchases/supplier-order-form";
import { listPurchaseSuppliers, listPurchaseProducts } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function NewSupplierOrderPage() {
  const [suppliers, products] = await Promise.all([listPurchaseSuppliers(), listPurchaseProducts()]);
  return (
    <ModulePage>
      <SupplierOrderForm suppliers={suppliers} products={products} />
    </ModulePage>
  );
}
