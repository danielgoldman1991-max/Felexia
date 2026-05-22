import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrContractForm } from "@/components/hr/hr-contract-form";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewHrContractPage() {
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Nouveau contrat" description="Modèle préparatoire à valider juridiquement avant signature." />
      <HrContractForm employees={employees.map((employee) => ({ id: employee.id, full_name: employee.full_name, base_salary: employee.base_salary }))} />
    </ModulePage>
  );
}
