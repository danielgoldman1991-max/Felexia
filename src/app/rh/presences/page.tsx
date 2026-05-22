import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPresencesPage() {
  const rows = await listHrTable("hr_attendance");
  return <ModulePage><HrSectionPage title="Présences" description="Saisie manuelle, retards, heures travaillées, heures supplémentaires et import pointeuse futur." rows={rows} columns={[{ key: "attendance_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "worked_hours", label: "Heures" }, { key: "overtime_hours", label: "Sup." }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
