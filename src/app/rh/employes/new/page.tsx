import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrEmployeeForm } from "@/components/hr/hr-employee-form";
import { getHrReferenceData } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewHrEmployeePage() {
  const { departments, positions } = await getHrReferenceData();
  return (
    <ModulePage>
      <PageHeader title="Nouvel employé" description="Créez une fiche salarié complète : identité, poste, salaire, CNSS/RIB et situation RH." />
      <HrEmployeeForm departments={departments} positions={positions} />
    </ModulePage>
  );
}
