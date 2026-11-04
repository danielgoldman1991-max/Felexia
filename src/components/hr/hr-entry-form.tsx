import type { InputHTMLAttributes, ReactNode } from "react";

const fieldClass = "h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3";

export function HrEntryForm({ action, children }: { action: (formData: FormData) => Promise<void>; children: ReactNode }) {
  return <form action={action} className="grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">{children}</form>;
}

export function HrField({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`space-y-1 text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function HrSelect({ name, required = false, defaultValue = "", children }: { name: string; required?: boolean; defaultValue?: string; children: ReactNode }) {
  return <select name={name} required={required} defaultValue={defaultValue} className={fieldClass}>{children}</select>;
}

export function HrInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={fieldClass} />;
}

export function HrTextarea({ name, placeholder }: { name: string; placeholder?: string }) {
  return <textarea name={name} rows={3} placeholder={placeholder} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" />;
}

export function EmployeeOptions({ employees }: { employees: Array<{ id: string; full_name: string; employee_number?: string | null }> }) {
  return (
    <>
      <option value="">Sélectionner</option>
      {employees.map((employee) => (
        <option key={employee.id} value={employee.id}>{employee.full_name}{employee.employee_number ? ` · ${employee.employee_number}` : ""}</option>
      ))}
    </>
  );
}
