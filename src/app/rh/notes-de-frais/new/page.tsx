import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrEntryForm, HrField, HrInput, HrTextarea } from "@/components/hr/hr-entry-form";
import { createHrOperationalRecordAction } from "@/lib/hr/contract-actions";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Nouvelle note de frais" description="Montants en MAD. La TVA saisie est informative et ne génère pas d'écriture comptable." />
      <HrEntryForm action={createHrOperationalRecordAction}>
        <input type="hidden" name="kind" value="expense" />
        <HrField label="Salarié" wide><select name="employee_id" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3"><EmployeeOptions employees={employees} /></select></HrField>
        <HrField label="Numéro"><HrInput name="expense_number" required placeholder="NDF-2026-001" /></HrField>
        <HrField label="Date"><HrInput name="expense_date" type="date" required /></HrField>
        <HrField label="Catégorie"><HrInput name="category" required placeholder="Déplacement, repas, fournitures" /></HrField>
        <HrField label="Montant HT"><HrInput name="amount_ht" type="number" min="0" step="0.01" required /></HrField>
        <HrField label="TVA"><HrInput name="tax_amount" type="number" min="0" step="0.01" defaultValue="0" /></HrField>
        <HrField label="Note" wide><HrTextarea name="notes" /></HrField>
        <div className="md:col-span-2 flex justify-end"><Button type="submit">Soumettre</Button></div>
      </HrEntryForm>
    </ModulePage>
  );
}
