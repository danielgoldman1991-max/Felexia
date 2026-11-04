import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrCheckToggle } from "@/components/hr/hr-check-toggle";
import { OFFBOARDING_CHECKS } from "@/lib/hr/checks";
import { requireHrWorkspace } from "@/lib/hr/access";
import { listHrEmployees } from "@/lib/hr/hr";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { isMissingRelation } from "@/lib/hr/notify";

export const dynamic = "force-dynamic";

export default async function HrOffboardingPage() {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const employees = await listHrEmployees();
  const [checks, settlements] = await Promise.all([
    supabase.from("hr_employee_checks").select("employee_id, item_key, done").eq("organization_id", workspace.organization.id).eq("kind", "offboarding"),
    supabase.from("hr_final_settlements").select("id, settlement_number, employee_id, exit_date, total_amount, reason").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const missing = isMissingRelation(checks.error) || isMissingRelation(settlements.error);
  const done = new Set((checks.data ?? []).filter((row) => row.done).map((row) => `${row.employee_id}:${row.item_key}`));
  return (
    <ModulePage>
      <PageHeader title="Départs" description="Fin de contrat depuis la fiche contrat, solde de tout compte imprimable et points de contrôle internes." />
      {missing ? <p className="text-sm text-[var(--muted)]">L&apos;enregistrement des départs attend la migration 123. Les contrats existants restent consultables.</p> : null}
      <section className="space-y-3">
        <h2 className="font-semibold">Soldes préparés</h2>
        {(settlements.data ?? []).length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun solde enregistré. Clôturez un contrat pour le préparer.</p> : (
          <ul className="space-y-2">
            {(settlements.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-sm">
                <span>{row.settlement_number} · {formatDate(row.exit_date)} · {formatMoney(Number(row.total_amount))}</span>
                <Link className="font-medium text-[var(--primary)] hover:underline" href={`/rh/offboarding/${row.id}/print`}>Imprimer</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8 space-y-6">
        <h2 className="font-semibold">Points de contrôle</h2>
        {employees.filter((employee) => employee.employment_status === "terminated").slice(0, 12).map((employee) => (
          <div key={employee.id}>
            <p className="mb-2 font-medium">{employee.full_name}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {OFFBOARDING_CHECKS.map((item) => (
                <HrCheckToggle key={item.key} employeeId={employee.id} kind="offboarding" itemKey={item.key} label={item.label} done={done.has(`${employee.id}:${item.key}`)} />
              ))}
            </div>
          </div>
        ))}
        {employees.every((employee) => employee.employment_status !== "terminated") ? <p className="text-sm text-[var(--muted)]">Les points apparaissent lorsqu&apos;un salarié est passé au statut sortie.</p> : null}
      </section>
    </ModulePage>
  );
}
