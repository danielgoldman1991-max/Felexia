import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrEntryForm, HrField, HrInput, HrSelect, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrEvaluationAction } from "@/lib/hr/consult-actions";
import { listHrEmployees, listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrEvaluationsPage() {
  const [rows, employees] = await Promise.all([listHrTable("hr_evaluations"), listHrEmployees()]);
  return <ModulePage>
    <HrEntryForm action={createHrEvaluationAction}>
      <HrField label="Salarié" wide><HrSelect name="employee_id" required><EmployeeOptions employees={employees} /></HrSelect></HrField>
      <HrField label="Date"><HrInput name="evaluation_date" type="date" required /></HrField>
      <HrField label="Période"><HrInput name="period_label" placeholder="2026 S1" /></HrField>
      <HrField label="Score"><HrInput name="score" type="number" min="0" max="20" step="0.1" /></HrField>
      <HrField label="Points forts" wide><HrTextarea name="strengths" /></HrField>
      <HrField label="Axes" wide><HrTextarea name="improvements" /></HrField>
      <div className="erp-form-actions md:col-span-2 flex justify-end"><Button type="submit">Enregistrer l’évaluation</Button></div>
    </HrEntryForm>
    <HrSectionPage title="Évaluations" description="Suivi des scores, objectifs, forces et axes d'amélioration par salarié." rows={rows} newHref="/rh/evaluations#creer" columns={[{ key: "evaluation_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "period_label", label: "Période" }, { key: "score", label: "Score" }, { key: "status", label: "Statut", status: true }]} />
  </ModulePage>;
}
