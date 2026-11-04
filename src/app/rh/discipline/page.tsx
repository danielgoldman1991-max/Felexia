import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrEntryForm, HrField, HrInput, HrSelect, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrDisciplineAction } from "@/lib/hr/consult-actions";
import { listHrEmployees, listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrDisciplinePage() {
  const [rows, employees] = await Promise.all([listHrTable("hr_disciplinary_actions"), listHrEmployees()]);
  return <ModulePage>
    <HrEntryForm action={createHrDisciplineAction}>
      <HrField label="Salarié" wide><HrSelect name="employee_id" required><EmployeeOptions employees={employees} /></HrSelect></HrField>
      <HrField label="Date"><HrInput name="action_date" type="date" required /></HrField>
      <HrField label="Type"><HrSelect name="action_type" required defaultValue="warning"><option value="observation">Observation</option><option value="warning">Avertissement</option><option value="blame">Blâme</option><option value="suspension">Mise à pied</option><option value="other">Autre</option></HrSelect></HrField>
      <HrField label="Motif" wide><HrTextarea name="reason" /></HrField>
      <div className="md:col-span-2 flex justify-end"><Button type="submit">Enregistrer</Button></div>
    </HrEntryForm>
    <HrSectionPage title="Discipline" description="Suivi interne des observations, avertissements, blâmes et suspensions, sans automatisme juridique." rows={rows} newHref="/rh/discipline#creer" columns={[{ key: "action_date", label: "Date" }, { key: "employee_id", label: "Employé" }, { key: "action_type", label: "Type" }, { key: "reason", label: "Motif" }, { key: "status", label: "Statut", status: true }]} />
  </ModulePage>;
}
