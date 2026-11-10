import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { HrBoundForm } from "@/components/hr/hr-entry-form";
import { createHrLeaveRequestAction } from "@/lib/hr/actions";
import { listHrEmployees } from "@/lib/hr/hr";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewHrLeavePage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  await ensureHrReferenceData(supabase, workspace.organization.id);
  const [employees, typesResult] = await Promise.all([
    listHrEmployees(),
    supabase.from("hr_leave_types").select("id,name").eq("organization_id", workspace.organization.id).eq("is_active", true).order("name"),
  ]);
  const types = typesResult.data ?? [];

  return (
    <ModulePage>
      <PageHeader title="Nouvelle demande de congé" description="La demande reste en attente jusqu'à validation. Le calcul des droits légaux reste préparatoire." />
      <HrBoundForm action={createHrLeaveRequestAction} className="erp-form grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Salarié</span>
          <select name="employee_id" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
            <option value="">Sélectionner</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Type de congé</span>
          <select name="leave_type_id" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
            <option value="">Sélectionner</option>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Début</span>
          <input name="start_date" type="date" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Fin</span>
          <input name="end_date" type="date" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre de jours</span>
          <input name="days_count" type="number" min="0.5" step="0.5" defaultValue="1" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Motif</span>
          <textarea name="reason" rows={3} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder="Congé annuel, maladie..." />
        </label>
        <div className="erp-form-actions md:col-span-2 flex justify-end">
          <Button type="submit">Enregistrer la demande</Button>
        </div>
      </HrBoundForm>
    </ModulePage>
  );
}
