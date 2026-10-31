import { notFound, redirect } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SupplierCreditNoteForm } from "@/components/purchases/supplier-credit-note-form";
import { getSupplierCreditNoteFormData } from "@/lib/supplier-credit-notes";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function EditSupplierCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (isReadOnlyRole(workspace.role) || !canWriteWorkspaceSubscription(workspace.subscription)) redirect(`/achats/avoirs/${id}`);
  const data = await getSupplierCreditNoteFormData({ creditNoteId: id });
  if (!data.creditNote) notFound();
  if (data.creditNote.status !== "draft") redirect(`/achats/avoirs/${id}`);
  return <ModulePage><div className="space-y-5"><PageHeader title={`Modifier l’avoir ${data.creditNote.credit_note_number}`} description="Les modifications concernent uniquement ce brouillon. La référence interne est conservée." /><SupplierCreditNoteForm {...data} creditNote={data.creditNote} /></div></ModulePage>;
}
