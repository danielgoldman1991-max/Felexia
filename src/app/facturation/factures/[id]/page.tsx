import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerInvoiceDetail } from "@/components/invoices/customer-invoice-detail";
import { getCustomerInvoiceDetail } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, lines } = await getCustomerInvoiceDetail(id);

  if (!invoice) notFound();

  return (
    <ModulePage>
      <CustomerInvoiceDetail invoice={invoice} lines={lines} />
    </ModulePage>
  );
}
