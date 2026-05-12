import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerCreditNoteDetail } from "@/components/credit-notes/customer-credit-note-detail";
import { getCreditNoteDocumentFlow, getCustomerCreditNoteDetail } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

export default async function CustomerCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ creditNote, lines, applications }, documentFlow] = await Promise.all([
    getCustomerCreditNoteDetail(id),
    getCreditNoteDocumentFlow(id),
  ]);
  if (!creditNote) notFound();
  return <ModulePage><CustomerCreditNoteDetail creditNote={creditNote} lines={lines} applications={applications} documentFlow={documentFlow} /></ModulePage>;
}
