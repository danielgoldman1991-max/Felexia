import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerInvoiceForm } from "@/components/invoices/customer-invoice-form";
import { updateCustomerInvoice } from "@/lib/invoice-actions";
import { getCustomerInvoiceDetail, listInvoiceCustomers, listInvoiceProducts, listInvoiceTaxRates, listInvoiceUnits } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function EditCustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ invoice, lines }, customers, products, units, taxRates] = await Promise.all([
    getCustomerInvoiceDetail(id),
    listInvoiceCustomers(),
    listInvoiceProducts(),
    listInvoiceUnits(),
    listInvoiceTaxRates(),
  ]);

  if (!invoice || invoice.status !== "draft") notFound();

  return (
    <ModulePage>
      <PageHeader title="Modifier la facture" description={invoice.invoice_number} />
      <CustomerInvoiceForm
        action={updateCustomerInvoice}
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        invoiceId={invoice.id}
        initialCustomerId={invoice.customer_id}
        initialInvoiceDate={invoice.invoice_date}
        initialDueDate={invoice.due_date}
        initialPaymentTermsDays={invoice.payment_terms_days}
        initialNotes={invoice.notes}
        initialInternalNotes={invoice.internal_notes}
        initialLines={lines.map((line) => ({
          ...line,
          mode: line.product_id ? "product" : "free",
          product_id: line.product_id ?? "",
          product_name: line.product_name ?? "",
          unit_id: line.unit_id ?? "",
          unit_name: line.unit_name ?? "",
          tax_rate_id: line.tax_rate_id ?? "",
        }))}
        sourceType={invoice.source_type ?? "manual"}
        sourceDocumentId={invoice.source_document_id ?? ""}
        sourceOrderId={invoice.source_order_id ?? ""}
        sourceDeliveryId={invoice.source_delivery_id ?? ""}
        submitLabel="Enregistrer"
      />
    </ModulePage>
  );
}
