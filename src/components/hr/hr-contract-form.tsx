import { createHrContractAction } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";

type EmployeeOption = { id: string; full_name: string; base_salary?: number | null };

export function HrContractForm({ employees }: { employees: EmployeeOption[] }) {
  return (
    <form action={createHrContractAction} className="premium-card grid gap-5 p-6 md:grid-cols-2">
      <label className="space-y-2 text-sm">
        <span className="section-title">Employé</span>
        <select name="employee_id" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]">
          <option value="">Sélectionner</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
        </select>
      </label>
      <Field name="contract_number" label="N° contrat" required />
      <label className="space-y-2 text-sm">
        <span className="section-title">Type</span>
        <select name="contract_type" required defaultValue="CDI" className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]">
          {["CDI", "CDD", "ANAPEC", "STAGE", "INTERIM", "CONSULTANT", "OTHER"].map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <Field name="start_date" label="Date début" type="date" required />
      <Field name="end_date" label="Date fin" type="date" />
      <Field name="trial_period_end" label="Fin période d'essai" type="date" />
      <Field name="weekly_hours" label="Heures / semaine" type="number" defaultValue={44} />
      <Field name="base_salary" label="Salaire de base" type="number" step="0.01" required />
      <label className="space-y-2 text-sm md:col-span-2">
        <span className="section-title">Clauses / notes</span>
        <textarea name="clauses" rows={4} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]" />
      </label>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit">Créer le contrat</Button>
      </div>
    </form>
  );
}

function Field({ name, label, type = "text", defaultValue, required, step }: { name: string; label: string; type?: string; defaultValue?: string | number; required?: boolean; step?: string }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="section-title">{label}</span>
      <input name={name} type={type} step={step} required={required} defaultValue={defaultValue ?? ""} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" />
    </label>
  );
}
