import { createHrEmployeeAction, updateHrEmployeeAction } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";

type Option = { id: string; name?: string; title?: string };
type EmployeeRecord = {
  id?: string;
  employee_number?: string | null;
  hire_date?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  cin?: string | null;
  cnss_number?: string | null;
  rib?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  employment_status?: string | null;
  base_salary?: number | null;
  department?: { id: string; name: string } | null;
  position?: { id: string; title: string } | null;
  [key: string]: unknown;
};

export function HrEmployeeForm({
  departments,
  positions,
  employee,
}: {
  departments: Option[];
  positions: Option[];
  employee?: EmployeeRecord;
}) {
  const action = employee?.id
    ? updateHrEmployeeAction.bind(null, String(employee.id))
    : createHrEmployeeAction;

  return (
    <form action={action} className="premium-card grid gap-5 p-6 md:grid-cols-2">
      <Field name="employee_number" label="Matricule" required defaultValue={employee?.employee_number} />
      <Field name="hire_date" label="Date d'embauche" type="date" required defaultValue={employee?.hire_date} />
      <Field name="first_name" label="Prénom" required defaultValue={employee?.first_name} />
      <Field name="last_name" label="Nom" required defaultValue={employee?.last_name} />
      <Field name="email" label="Email" type="email" defaultValue={employee?.email} />
      <Field name="phone" label="Téléphone" defaultValue={employee?.phone} />
      <Field name="city" label="Ville" defaultValue={employee?.city} />
      <Field name="cin" label="CIN" defaultValue={employee?.cin} />
      <Field name="cnss_number" label="N° CNSS" defaultValue={employee?.cnss_number} />
      <Field name="rib" label="RIB (24 chiffres)" defaultValue={employee?.rib} />
      <SelectField name="marital_status" label="Situation familiale" defaultValue={String(employee?.marital_status ?? "")} options={[{ value: "celibataire", label: "Célibataire" }, { value: "marie", label: "Marié(e)" }, { value: "divorce", label: "Divorcé(e)" }, { value: "veuf", label: "Veuf(ve)" }]} />
      <Field name="dependents_count" label="Personnes à charge" type="number" min="0" defaultValue={Number(employee?.dependents_count ?? 0)} />
      <Field name="weekly_hours" label="Heures hebdomadaires" type="number" min="1" step="0.5" defaultValue={Number(employee?.weekly_hours ?? 44)} />
      <label className="flex items-center gap-2 text-sm"><input name="cimr_enabled" type="checkbox" defaultChecked={Boolean(employee?.cimr_enabled)} /> CIMR</label>
      <Field name="cimr_rate" label="Taux CIMR %" type="number" min="0" step="0.01" defaultValue={Number(employee?.cimr_rate ?? 0)} />
      <Field name="mutuelle_label" label="Mutuelle" defaultValue={String(employee?.mutuelle_label ?? "")} />
      <Field name="mutuelle_amount" label="Cotisation mutuelle" type="number" min="0" step="0.01" defaultValue={Number(employee?.mutuelle_amount ?? 0)} />
      <SelectField name="department_id" label="Département" options={departments.map((item) => ({ value: item.id, label: item.name ?? "" }))} defaultValue={employee?.department_id} />
      <SelectField name="position_id" label="Poste" options={positions.map((item) => ({ value: item.id, label: item.title ?? "" }))} defaultValue={employee?.position_id} />
      <SelectField
        name="employment_status"
        label="Statut"
        defaultValue={employee?.employment_status ?? "active"}
        options={[
          { value: "active", label: "Actif" },
          { value: "trial_period", label: "Période d'essai" },
          { value: "suspended", label: "Suspendu" },
          { value: "on_leave", label: "En congé" },
          { value: "terminated", label: "Sorti" },
        ]}
      />
      <Field name="base_salary" label="Salaire de base" type="number" step="0.01" required min="0" defaultValue={employee?.base_salary ?? 0} />
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit">{employee?.id ? "Enregistrer" : "Créer l'employé"}</Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="section-title">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        min={min}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | number | null;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="section-title">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]"
      >
        <option value="">Non renseigné</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
