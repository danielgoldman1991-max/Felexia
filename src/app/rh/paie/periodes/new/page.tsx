import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { createHrPayrollPeriodAction } from "@/lib/hr/actions";

export default function NewPayrollPeriodPage() {
  const now = new Date();
  return (
    <ModulePage>
      <PageHeader title="Nouvelle période de paie" description="Créez une période puis calculez les bulletins préparatoires." />
      <form action={createHrPayrollPeriodAction} className="premium-card grid gap-5 p-6 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="section-title">Mois</span>
          <input name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} className="h-11 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/[0.045] px-3" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="section-title">Année</span>
          <input name="year" type="number" defaultValue={now.getFullYear()} className="h-11 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/[0.045] px-3" />
        </label>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit">Créer la période</Button>
        </div>
      </form>
    </ModulePage>
  );
}
