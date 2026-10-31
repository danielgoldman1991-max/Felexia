import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { CustomerInvoicePrintView } from "@/components/invoices/customer-invoice-print-view";
import { getCustomerInvoiceDetail } from "@/lib/invoices";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { requireActiveWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getCustomerInvoiceDetail(id);

  if (!invoice) notFound();

  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);

  return (
    <div className="print-preview">
      <PrintActions backHref={`/facturation/factures/${invoice.id}`} backLabel="Retour facture" />
      <CustomerInvoicePrintView invoice={invoice} lines={lines} identity={identity} />
    </div>
  );
}
