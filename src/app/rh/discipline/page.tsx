import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrDisciplinePage() {
  const rows = await listHrTable("hr_disciplinary_actions");
  return <ModulePage><HrSectionPage title="Discipline" description="Suivi interne des observations, avertissements, blâmes et suspensions, sans automatisme juridique." rows={rows} columns={[{ key: "action_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "action_type", label: "Type" }, { key: "reason", label: "Motif" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
