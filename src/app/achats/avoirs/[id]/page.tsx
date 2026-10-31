import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierCreditNoteDetail } from "@/components/purchases/supplier-credit-note-detail";
import { getSupplierCreditNoteDetail } from "@/lib/supplier-credit-notes";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole, isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function SupplierCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const data = await getSupplierCreditNoteDetail(id);
  if (!data.creditNote) notFound();
  const canWrite = !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
  return <ModulePage><SupplierCreditNoteDetail {...data} creditNote={data.creditNote} accountingEntry={data.accountingEntry?.entry ? data.accountingEntry : null} canWrite={canWrite} canPost={canWrite && isAdminRole(workspace.role)} /></ModulePage>;
}
