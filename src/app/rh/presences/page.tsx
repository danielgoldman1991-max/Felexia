import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPresencesPage() {
  const rows = await listHrTable("hr_attendance");
  return <ModulePage><HrSectionPage title="Présences" description="Pointage manuel par jour. Aucune pointeuse n'est connectée." rows={rows} newHref="/rh/presences/new" columns={[{ key: "attendance_date", label: "Date" }, { key: "worked_hours", label: "Heures" }, { key: "overtime_hours", label: "Sup." }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
