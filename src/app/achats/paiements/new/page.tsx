import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentForm } from "@/components/purchases/supplier-payment-form";
import { listPurchaseSuppliers, getSupplierOpenInvoices } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function NewSupplierPaymentPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; invoiceId?: string }> }) {
  const [suppliers, params] = await Promise.all([listPurchaseSuppliers(), searchParams]);
  const openInvoices = params.supplierId ? await getSupplierOpenInvoices(params.supplierId) : [];
  return (
    <ModulePage>
      <SupplierPaymentForm
        suppliers={suppliers}
        openInvoices={openInvoices}
        preselectedSupplierId={params.supplierId}
        preselectedInvoiceId={params.invoiceId}
      />
    </ModulePage>
  );
}
