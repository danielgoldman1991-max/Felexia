import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default async function HrPayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModulePage>
      <PageHeader title="Bulletin préparatoire" description={`Bulletin ${id}. Ce bulletin doit être validé par la personne compétente avant remise.`} />
      <HrPreparatoryNotice />
    </ModulePage>
  );
}
