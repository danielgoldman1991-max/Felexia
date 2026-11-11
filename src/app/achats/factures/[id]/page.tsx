import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceDetail } from "@/components/purchases/supplier-invoice-detail";
import { getSupplierInvoiceDetail, getSupplierInvoiceDocumentFlow } from "@/lib/purchases";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isAccountingRole, isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";
import { getSupplierInvoiceScan } from "@/lib/purchases/supplier-invoice-ocr-actions";

export const dynamic = "force-dynamic";

export default async function SupplierInvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ piece?: string }> }) {
  const { id } = await params;
  const { piece } = await searchParams;
  const [{ invoice, lines, payments, paymentSummary }, documentFlow] = await Promise.all([
    getSupplierInvoiceDetail(id),
    getSupplierInvoiceDocumentFlow(id),
  ]);
  if (!invoice) notFound();

  const workspace = await getActiveWorkspace();
  const canWrite = Boolean(workspace && !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription));
  const orgId = workspace?.organization.id;
  const fullAccess = orgId && !isOperatorRole(workspace?.role) ? await hasFullErpAccess(orgId) : false;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "supplier_invoice", id) : null;
  const scan = workspace ? await getSupplierInvoiceScan(id) : null;

  return (
    <ModulePage>
      {piece === "absente" ? <p className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">La facture est enregistrée. Le document n’a pas pu être joint.</p> : null}
      <SupplierInvoiceDetail
        fullAccess={fullAccess}
        canWrite={canWrite}
        canPostAccounting={canWrite && isAccountingRole(workspace?.role)}
        invoice={invoice}
        lines={lines}
        payments={payments}
        paymentSummary={paymentSummary}
        accountingEntry={accountingEntry}
        documentFlow={documentFlow}
        scan={scan}
      />
    </ModulePage>
  );
}
