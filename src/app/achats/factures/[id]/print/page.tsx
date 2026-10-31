import { notFound } from "next/navigation";
import { SupplierInvoicePrintView } from "@/components/purchases/supplier-invoice-print-view";
import { PrintActions } from "@/components/sales/print-actions";
import { getSupplierInvoiceDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getSupplierInvoiceDetail(id);
  if (!invoice) notFound();
  const identity = await getOrganizationDocumentIdentity(invoice.organization_id);
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/achats/factures/${invoice.id}`} backLabel="Retour facture" />
      <SupplierInvoicePrintView invoice={invoice} lines={lines} identity={identity} />
    </main>
  );
}
