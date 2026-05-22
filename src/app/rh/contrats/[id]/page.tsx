import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default async function HrContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModulePage>
      <PageHeader title="Contrat RH" description={`Détail du contrat ${id}. Les modèles restent préparatoires et doivent être validés juridiquement.`} />
      <HrPreparatoryNotice />
    </ModulePage>
  );
}
