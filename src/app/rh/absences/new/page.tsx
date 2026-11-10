import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrBoundForm, HrField, HrInput, HrSelect, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrOperationalRecordAction } from "@/lib/hr/contract-actions";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewAbsencePage() {
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Nouvelle absence" description="L'absence est enregistrée en brouillon, puis validée ou annulée." />
      <HrBoundForm action={createHrOperationalRecordAction} className="erp-form grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
        <input type="hidden" name="kind" value="absence" />
        <HrField label="Salarié" wide><HrSelect name="employee_id" required><EmployeeOptions employees={employees} /></HrSelect></HrField>
        <HrField label="Date"><HrInput name="absence_date" type="date" required /></HrField>
        <HrField label="Type"><HrSelect name="absence_type" required defaultValue="injustifiee"><option value="injustifiee">Injustifiée</option><option value="maladie">Maladie</option><option value="autorisation">Autorisation</option><option value="autre">Autre</option></HrSelect></HrField>
        <HrField label="Justifiée" wide><input name="justified" type="checkbox" className="h-4 w-4" /> <span className="ml-2">Justificatif reçu</span></HrField>
        <HrField label="Motif" wide><HrTextarea name="reason" /></HrField>
        <div className="erp-form-actions md:col-span-2 flex justify-end"><Button type="submit">Enregistrer</Button></div>
      </HrBoundForm>
    </ModulePage>
  );
}
