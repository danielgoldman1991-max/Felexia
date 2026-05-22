import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrEvaluationsPage() {
  const rows = await listHrTable("hr_evaluations");
  return <ModulePage><HrSectionPage title="Évaluations" description="Suivi des scores, objectifs, forces et axes d'amélioration par salarié." rows={rows} columns={[{ key: "evaluation_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "period_label", label: "Période" }, { key: "score", label: "Score" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
