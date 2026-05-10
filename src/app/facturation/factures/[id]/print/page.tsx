import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { CustomerInvoicePrintView } from "@/components/invoices/customer-invoice-print-view";
import { getCustomerInvoiceDetail } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function CustomerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getCustomerInvoiceDetail(id);

  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/facturation/factures/${invoice.id}`} backLabel="Retour facture" />
      <CustomerInvoicePrintView invoice={invoice} lines={lines} />
    </main>
  );
}
