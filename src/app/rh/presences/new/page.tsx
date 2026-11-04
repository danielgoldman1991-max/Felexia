import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrEntryForm, HrField, HrInput, HrSelect, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrOperationalRecordAction } from "@/lib/hr/contract-actions";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewAttendancePage() {
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Pointage manuel" description="Une ligne par salarié et par jour. Ce n'est pas une pointeuse." />
      <HrEntryForm action={createHrOperationalRecordAction}>
        <input type="hidden" name="kind" value="attendance" />
        <HrField label="Salarié" wide><HrSelect name="employee_id" required><EmployeeOptions employees={employees} /></HrSelect></HrField>
        <HrField label="Date"><HrInput name="attendance_date" type="date" required /></HrField>
        <HrField label="Statut">
          <HrSelect name="status" defaultValue="present">
            <option value="present">Présent</option>
            <option value="late">Retard</option>
            <option value="half_day">Demi-journée</option>
            <option value="remote">Télétravail</option>
            <option value="absent">Absent</option>
            <option value="leave">Congé</option>
            <option value="sick_leave">Maladie</option>
            <option value="holiday">Férié</option>
          </HrSelect>
        </HrField>
        <HrField label="Heures travaillées"><HrInput name="worked_hours" type="number" min="0" max="24" step="0.5" defaultValue="8" /></HrField>
        <HrField label="Heures supplémentaires"><HrInput name="overtime_hours" type="number" min="0" max="24" step="0.5" defaultValue="0" /></HrField>
        <HrField label="Note" wide><HrTextarea name="notes" /></HrField>
        <div className="md:col-span-2 flex justify-end"><Button type="submit">Enregistrer</Button></div>
      </HrEntryForm>
    </ModulePage>
  );
}
