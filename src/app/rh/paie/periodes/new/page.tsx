import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { requireHrWorkspace } from "@/lib/hr/access";
import { createHrPayrollPeriodAction } from "@/lib/hr/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewPayrollPeriodPage() {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const { data: existing } = await supabase.from("hr_payroll_periods").select("year, month").eq("organization_id", workspace.organization.id);
  const known = new Set((existing ?? []).map((row) => `${row.year}-${row.month}`));
  const preferred = !known.has(`${previous.getUTCFullYear()}-${previous.getUTCMonth() + 1}`)
    ? previous
    : !known.has(`${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`)
      ? now
      : previous;
  return (
    <ModulePage>
      <PageHeader title="Nouvelle période de paie" description="Le mois proposé est le mois précédent s'il n'existe pas encore." />
      <form action={createHrPayrollPeriodAction} className="erp-form rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] grid gap-5 p-6 shadow-[var(--shadow-sm)] md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="section-title">Mois</span>
          <input name="month" type="number" min="1" max="12" defaultValue={preferred.getUTCMonth() + 1} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="section-title">Année</span>
          <input name="year" type="number" defaultValue={preferred.getUTCFullYear()} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" />
        </label>
        <div className="erp-form-actions md:col-span-2 flex justify-end">
          <Button type="submit">Créer la période</Button>
        </div>
      </form>
    </ModulePage>
  );
}
