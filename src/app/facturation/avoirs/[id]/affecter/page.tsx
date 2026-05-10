import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CreditNoteApplicationForm } from "@/components/credit-notes/credit-note-application-form";
import { getCustomerCreditNoteDetail, listOpenInvoicesForCreditApplication } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

export default async function ApplyCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote } = await getCustomerCreditNoteDetail(id);
  if (!creditNote || creditNote.status === "cancelled") notFound();
  const invoices = await listOpenInvoicesForCreditApplication(creditNote.customer_id);
  return (
    <ModulePage>
      <PageHeader title="Affecter l'avoir" description={creditNote.credit_note_number} />
      <CreditNoteApplicationForm creditNote={creditNote} invoices={invoices} />
    </ModulePage>
  );
}
