import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceForm } from "@/components/purchases/supplier-invoice-form";
import { getSupplierInvoiceDetail, listPurchaseSuppliers, listPurchaseProducts } from "@/lib/purchases";
import { listInvoiceTaxRates } from "@/lib/invoices";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function EditSupplierInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const [result, suppliers, products, taxRates] = await Promise.all([getSupplierInvoiceDetail(id), listPurchaseSuppliers(), fullAccess ? listPurchaseProducts() : Promise.resolve([]), listInvoiceTaxRates()]);
  if (!result.invoice) notFound();
  return (
    <ModulePage>
      <SupplierInvoiceForm fullAccess={fullAccess} taxRates={taxRates} suppliers={suppliers} products={products} invoice={result.invoice} lines={result.lines} />
    </ModulePage>
  );
}
