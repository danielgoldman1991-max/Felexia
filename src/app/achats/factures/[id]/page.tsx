import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceDetail } from "@/components/purchases/supplier-invoice-detail";
import { getSupplierInvoiceDetail, getSupplierInvoiceDocumentFlow } from "@/lib/purchases";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ invoice, lines, payments, paymentSummary }, documentFlow] = await Promise.all([
    getSupplierInvoiceDetail(id),
    getSupplierInvoiceDocumentFlow(id),
  ]);
  if (!invoice) notFound();

  const workspace = await getActiveWorkspace();
  const orgId = workspace?.organization.id;
  const fullAccess = orgId && !isOperatorRole(workspace?.role) ? await hasFullErpAccess(orgId) : false;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "supplier_invoice", id) : null;

  return (
    <ModulePage>
      <SupplierInvoiceDetail
        fullAccess={fullAccess}
        canPostAccounting={!isOperatorRole(workspace?.role) && !isReadOnlyRole(workspace?.role)}
        invoice={invoice}
        lines={lines}
        payments={payments}
        paymentSummary={paymentSummary}
        accountingEntry={accountingEntry}
        documentFlow={documentFlow}
      />
    </ModulePage>
  );
}
