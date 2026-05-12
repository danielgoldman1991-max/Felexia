import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceDetail } from "@/components/purchases/supplier-invoice-detail";
import { getSupplierInvoiceDetail, getSupplierInvoiceDocumentFlow } from "@/lib/purchases";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ invoice, lines }, documentFlow] = await Promise.all([
    getSupplierInvoiceDetail(id),
    getSupplierInvoiceDocumentFlow(id),
  ]);
  if (!invoice) notFound();

  const workspace = await getActiveWorkspace();
  const orgId = workspace?.organization.id;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "supplier_invoice", id) : null;

  return (
    <ModulePage>
      <SupplierInvoiceDetail invoice={invoice} lines={lines} accountingEntry={accountingEntry} documentFlow={documentFlow} />
    </ModulePage>
  );
}
