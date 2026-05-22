import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrCnssPage() {
  const employees = await listHrEmployees();
  const rows = employees.map((employee) => ({
    id: employee.id,
    employee_number: employee.employee_number,
    full_name: employee.full_name,
    cnss_number: employee.cnss_number ?? "À compléter",
    base_salary: employee.base_salary,
    status: employee.cnss_number ? "ready" : "missing",
  }));
  return <ModulePage><HrSectionPage title="CNSS / AMO préparatoire" description="Liste déclarable, anomalies CNSS/AMO et export de contrôle préparatoire. Déclaration officielle hors Felexia." rows={rows} notice columns={[{ key: "employee_number", label: "Matricule" }, { key: "full_name", label: "Employé" }, { key: "cnss_number", label: "CNSS" }, { key: "base_salary", label: "Base", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
