import { redirect } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SupplierCreditNoteForm } from "@/components/purchases/supplier-credit-note-form";
import { getSupplierCreditNoteFormData } from "@/lib/supplier-credit-notes";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function NewSupplierCreditNotePage({ searchParams }: { searchParams: Promise<{ invoiceId?: string; sourceInvoiceId?: string; source_invoice_id?: string }> }) {
  const workspace = await requireActiveWorkspace();
  if (isReadOnlyRole(workspace.role) || !canWriteWorkspaceSubscription(workspace.subscription)) redirect("/achats/avoirs");
  const params = await searchParams;
  const sourceInvoiceId = params.invoiceId ?? params.sourceInvoiceId ?? params.source_invoice_id;
  const data = await getSupplierCreditNoteFormData({ sourceInvoiceId });
  return <ModulePage><div className="space-y-5"><PageHeader title="Nouvel avoir fournisseur" description="Reprenez la référence et les montants du document reçu. Aucun mouvement de stock n’est nécessaire." /><SupplierCreditNoteForm {...data} creditNote={data.creditNote ?? undefined} /></div></ModulePage>;
}
