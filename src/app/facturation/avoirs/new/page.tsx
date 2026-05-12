import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerCreditNoteForm } from "@/components/credit-notes/customer-credit-note-form";
import { getCreditNoteFormOptions } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ invoiceId?: string; returnId?: string }>;

export default async function NewCustomerCreditNotePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { customers, products, units, taxRates, sourceInvoice, sourceReturn, returnPreparation, sourceLines } = await getCreditNoteFormOptions(params.invoiceId, params.returnId);
  const initialCustomerId = sourceReturn?.customer_id ?? sourceInvoice?.customer_id ?? "";
  return (
    <ModulePage>
      <PageHeader title="Nouvel avoir client" description="Creez un avoir depuis un bon de retour valide, une facture ou une saisie libre." />
      <CustomerCreditNoteForm
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        initialCustomerId={initialCustomerId}
        sourceInvoiceId={sourceInvoice?.id ?? ""}
        sourceReturnId={sourceReturn?.id ?? ""}
        sourceReturnNumber={sourceReturn?.document_number ?? ""}
        sourceType={sourceReturn ? "return" : undefined}
        defaultReason={sourceReturn?.return_reason ?? (sourceReturn ? "Avoir suite retour client" : "")}
        initialLines={sourceLines}
      />
      {returnPreparation?.existingCreditNote ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ce bon de retour est deja rattache a un avoir client. La creation sera bloquee cote serveur pour eviter un doublon.
        </p>
      ) : null}
    </ModulePage>
  );
}
