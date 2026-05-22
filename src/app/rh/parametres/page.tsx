import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { getHrReferenceData } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrSettingsPage() {
  const { departments, positions, leaveTypes, settings } = await getHrReferenceData();
  return (
    <ModulePage>
      <PageHeader title="Paramètres RH" description="Référentiels RH, congés, rubriques de paie, paramètres sociaux et IR configurables." />
      <HrPreparatoryNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SettingCard title="Départements" value={departments.length} />
        <SettingCard title="Postes" value={positions.length} />
        <SettingCard title="Types de congés" value={leaveTypes.length} />
        <SettingCard title="Heures hebdomadaires" value={Number(settings?.default_weekly_hours ?? 44)} />
        <SettingCard title="Congés annuels" value={`${settings?.default_annual_leave_days ?? 18} jours`} />
        <SettingCard title="Acquisition mensuelle" value={`${settings?.leave_accrual_days_per_month ?? 1.5} jours`} />
        <SettingCard title="CNSS" value={settings?.cnss_enabled ? "Activée" : "Désactivée"} />
        <SettingCard title="IR" value={settings?.ir_enabled ? "Activé" : "Désactivé"} />
      </div>
    </ModulePage>
  );
}

function SettingCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="premium-card p-5">
      <p className="section-title">{title}</p>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}
