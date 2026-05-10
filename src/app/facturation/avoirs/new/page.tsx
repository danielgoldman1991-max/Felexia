import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerCreditNoteForm } from "@/components/credit-notes/customer-credit-note-form";
import { getCreditNoteFormOptions } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ invoiceId?: string }>;

export default async function NewCustomerCreditNotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { customers, products, units, taxRates, sourceInvoice, sourceLines } = await getCreditNoteFormOptions(params.invoiceId);
  return (
    <ModulePage>
      <PageHeader title="Nouvel avoir client" description="Creez un avoir libre ou pre-rempli depuis une facture." />
      <CustomerCreditNoteForm
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        initialCustomerId={sourceInvoice?.customer_id ?? ""}
        sourceInvoiceId={sourceInvoice?.id ?? ""}
        initialLines={sourceLines}
      />
    </ModulePage>
  );
}
