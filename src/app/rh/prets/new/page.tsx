import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrBoundForm, HrField, HrInput, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrOperationalRecordAction } from "@/lib/hr/contract-actions";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewLoanPage() {
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Nouveau prêt" description="Le capital restant dû est initialisé au montant du prêt. La retenue mensuelle est indicative pour la paie." />
      <HrBoundForm action={createHrOperationalRecordAction} className="grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
        <input type="hidden" name="kind" value="loan" />
        <HrField label="Salarié" wide><select name="employee_id" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3"><EmployeeOptions employees={employees} /></select></HrField>
        <HrField label="Numéro"><HrInput name="loan_number" required placeholder="PRT-2026-001" /></HrField>
        <HrField label="Montant MAD"><HrInput name="amount" type="number" min="0.01" step="0.01" required /></HrField>
        <HrField label="Retenue mensuelle MAD"><HrInput name="monthly_deduction" type="number" min="0" step="0.01" required /></HrField>
        <HrField label="Mois de début"><HrInput name="start_month" type="number" min="1" max="12" required /></HrField>
        <HrField label="Année de début"><HrInput name="start_year" type="number" min="2000" max="2200" required /></HrField>
        <HrField label="Note" wide><HrTextarea name="notes" /></HrField>
        <div className="md:col-span-2 flex justify-end"><Button type="submit">Enregistrer</Button></div>
      </HrBoundForm>
    </ModulePage>
  );
}
