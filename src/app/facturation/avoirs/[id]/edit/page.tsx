import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { getCustomerCreditNoteDetail } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

export default async function EditCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) notFound();
  return (
    <ModulePage>
      <PageHeader title="Modifier avoir" description={creditNote.credit_note_number} />
      <EmptyState title="Edition a venir" description="La V1 permet la creation, validation, impression et affectation des avoirs. L'edition fine sera ajoutee ensuite." />
    </ModulePage>
  );
}
