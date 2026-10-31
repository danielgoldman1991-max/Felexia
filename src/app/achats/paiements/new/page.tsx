import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentForm } from "@/components/purchases/supplier-payment-form";
import { listPurchaseSuppliers, getSupplierInvoiceDetail, getSupplierOpenInvoices } from "@/lib/purchases";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function NewSupplierPaymentPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; invoiceId?: string }> }) {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  await getDefaultTreasuryAccountId();
  const [suppliers, treasuryAccounts, params] = await Promise.all([listPurchaseSuppliers(), listActiveTreasuryAccounts(), searchParams]);
  const preselectedDetail = params.invoiceId ? await getSupplierInvoiceDetail(params.invoiceId) : null;
  const preselectedInvoice = preselectedDetail?.invoice ?? null;
  const supplierId = params.supplierId ?? preselectedInvoice?.supplier_id;
  const openInvoices = supplierId ? await getSupplierOpenInvoices(supplierId) : [];
  const invoices = preselectedInvoice && !openInvoices.some((invoice) => invoice.id === preselectedInvoice.id)
    ? [preselectedInvoice, ...openInvoices]
    : openInvoices;
  return (
    <ModulePage>
      <SupplierPaymentForm
        fullAccess={fullAccess}
        suppliers={suppliers}
        openInvoices={invoices}
        treasuryAccounts={treasuryAccounts}
        preselectedSupplierId={supplierId}
        preselectedInvoiceId={params.invoiceId}
        preselectedPaymentSummary={preselectedDetail?.paymentSummary ?? null}
      />
    </ModulePage>
  );
}
