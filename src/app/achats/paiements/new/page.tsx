import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentForm } from "@/components/purchases/supplier-payment-form";
import { listPurchaseSuppliers, getSupplierOpenInvoices } from "@/lib/purchases";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function NewSupplierPaymentPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; invoiceId?: string }> }) {
  await getDefaultTreasuryAccountId();
  const [suppliers, treasuryAccounts, params] = await Promise.all([listPurchaseSuppliers(), listActiveTreasuryAccounts(), searchParams]);
  const openInvoices = params.supplierId ? await getSupplierOpenInvoices(params.supplierId) : [];
  return (
    <ModulePage>
      <SupplierPaymentForm
        suppliers={suppliers}
        openInvoices={openInvoices}
        treasuryAccounts={treasuryAccounts}
        preselectedSupplierId={params.supplierId}
        preselectedInvoiceId={params.invoiceId}
      />
    </ModulePage>
  );
}
