import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrAbsencesPage() {
  const rows = await listHrTable("hr_absences");
  return <ModulePage><HrSectionPage title="Absences" description="Absences justifiées ou non, certificats médicaux, impact paie préparatoire et validation RH." rows={rows} columns={[{ key: "absence_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "absence_type", label: "Type" }, { key: "justified", label: "Justifiée" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
