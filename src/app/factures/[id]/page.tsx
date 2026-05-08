import { EntityDetail } from "@/components/erp/entity-detail";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default async function FactureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModulePage>
      <PageHeader title="Detail facture" description="Echeance, paiements et relances." />
      <EntityDetail title="Facture client" id={id} />
    </ModulePage>
  );
}
