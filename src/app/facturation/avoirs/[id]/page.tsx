import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerCreditNoteDetail } from "@/components/credit-notes/customer-credit-note-detail";
import { getCreditNoteDocumentFlow, getCustomerCreditNoteDetail } from "@/lib/credit-notes";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole, isReadOnlyRole } from "@/lib/auth/roles";
import { getExistingEntryBySource } from "@/lib/accounting";

export const dynamic = "force-dynamic";

export default async function CustomerCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const [{ creditNote, lines, applications }, documentFlow] = await Promise.all([
    getCustomerCreditNoteDetail(id),
    getCreditNoteDocumentFlow(id),
  ]);
  if (!creditNote) notFound();
  const accountingEntry = await getExistingEntryBySource(workspace.organization.id, "customer_credit_note", id);
  return <ModulePage><CustomerCreditNoteDetail creditNote={creditNote} lines={lines} applications={applications} documentFlow={documentFlow} canWrite={!isReadOnlyRole(workspace.role)} canPost={isAdminRole(workspace.role)} accountingEntry={accountingEntry} /></ModulePage>;
}
