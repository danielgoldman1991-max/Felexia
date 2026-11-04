import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrCheckToggle } from "@/components/hr/hr-check-toggle";
import { ONBOARDING_CHECKS } from "@/lib/hr/checks";
import { requireHrWorkspace } from "@/lib/hr/access";
import { listHrEmployees } from "@/lib/hr/hr";
import { isMissingRelation } from "@/lib/hr/notify";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HrOnboardingPage() {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const employees = (await listHrEmployees()).filter((employee) => employee.employment_status === "active" || employee.employment_status === "trial_period").slice(0, 12);
  const checks = await supabase.from("hr_employee_checks").select("employee_id, item_key, done").eq("organization_id", workspace.organization.id).eq("kind", "onboarding");
  const done = new Set((checks.data ?? []).filter((row) => row.done).map((row) => `${row.employee_id}:${row.item_key}`));
  return (
    <ModulePage>
      <PageHeader title="Arrivées" description="Points de contrôle enregistrés pour les salariés actifs ou en période d'essai. Cette liste ne crée aucun accès." />
      {isMissingRelation(checks.error) ? <p className="text-sm text-[var(--muted)]">L&apos;enregistrement des points attend la migration 123.</p> : null}
      <div className="space-y-6">
        {employees.map((employee) => (
          <section key={employee.id}>
            <p className="mb-2 font-medium">{employee.full_name} · {employee.employee_number}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {ONBOARDING_CHECKS.map((item) => (
                <HrCheckToggle key={item.key} employeeId={employee.id} kind="onboarding" itemKey={item.key} label={item.label} done={done.has(`${employee.id}:${item.key}`)} />
              ))}
            </div>
          </section>
        ))}
        {employees.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun salarié actif.</p> : null}
      </div>
    </ModulePage>
  );
}
