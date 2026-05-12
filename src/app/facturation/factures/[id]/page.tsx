import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerInvoiceDetail } from "@/components/invoices/customer-invoice-detail";
import { getCustomerInvoiceDetail, getCustomerInvoiceDocumentFlow } from "@/lib/invoices";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ invoice, lines }, documentFlow] = await Promise.all([
    getCustomerInvoiceDetail(id),
    getCustomerInvoiceDocumentFlow(id),
  ]);

  if (!invoice) notFound();

  const workspace = await getActiveWorkspace();
  const orgId = workspace?.organization.id;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "customer_invoice", id) : null;

  return (
    <ModulePage>
      <CustomerInvoiceDetail invoice={invoice} lines={lines} accountingEntry={accountingEntry} documentFlow={documentFlow} />
    </ModulePage>
  );
}
