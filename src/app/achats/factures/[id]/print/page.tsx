import { notFound } from "next/navigation";
import { SupplierInvoicePrintView } from "@/components/purchases/supplier-invoice-print-view";
import { getSupplierInvoiceDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getSupplierInvoiceDetail(id);
  if (!invoice) notFound();
  const identity = await getOrganizationDocumentIdentity(invoice.organization_id);
  return <SupplierInvoicePrintView invoice={invoice} lines={lines} identity={identity} />;
}
