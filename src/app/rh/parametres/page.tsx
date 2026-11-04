import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrSettingsEditor, type HrCatalog } from "@/components/hr/hr-settings-editor";
import { requireHrWorkspace } from "@/lib/hr/access";
import { getHrReferenceData } from "@/lib/hr/hr";
import { canWriteHrSettings } from "@/lib/hr/settings-access";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HrSettingsPage() {
  const [{ departments, positions, leaveTypes, settings }, catalog, workspace] = await Promise.all([
    getHrReferenceData(),
    loadHrCatalog(),
    requireHrWorkspace(),
  ]);
  const canWrite = await canWriteHrSettings(workspace);
  return (
    <ModulePage>
      <PageHeader title="Paramètres RH" description="Départements, postes, types de congés et horaires. Les rubriques de paie restent préparatoires." />
      <HrPreparatoryNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SettingCard title="Départements" value={departments.length} />
        <SettingCard title="Postes" value={positions.length} />
        <SettingCard title="Types de congés" value={leaveTypes.length} />
        <SettingCard title="Horaires" value={catalog.schedules.filter((item) => item.is_active).length} />
        <SettingCard title="Heures hebdomadaires" value={Number(settings?.default_weekly_hours ?? 44)} />
        <SettingCard title="Congés annuels" value={`${settings?.default_annual_leave_days ?? 18} jours`} />
        <SettingCard title="Acquisition mensuelle" value={`${settings?.leave_accrual_days_per_month ?? 1.5} jours`} />
        <SettingCard title="CNSS" value={settings?.cnss_enabled ? "Activée" : "Désactivée"} />
        <SettingCard title="IR" value={settings?.ir_enabled ? "Activé" : "Désactivé"} />
      </div>
      <HrSettingsEditor catalog={catalog} canWrite={canWrite} />
    </ModulePage>
  );
}

async function loadHrCatalog(): Promise<HrCatalog> {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const [departments, positions, leaveTypes, schedules] = await Promise.all([
    supabase.from("hr_departments").select("id, name, code, is_active").eq("organization_id", orgId).order("name"),
    supabase.from("hr_positions").select("id, title, code, department_id, is_active").eq("organization_id", orgId).order("title"),
    supabase.from("hr_leave_types").select("id, name, code, is_paid, annual_entitlement_days, is_active").eq("organization_id", orgId).order("name"),
    supabase.from("hr_work_schedules").select("id, name, weekly_hours, work_days, notes, is_active").eq("organization_id", orgId).order("name"),
  ]);
  return {
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    leaveTypes: (leaveTypes.data ?? []).map((row) => ({ ...row, annual_entitlement_days: row.annual_entitlement_days == null ? null : Number(row.annual_entitlement_days) })),
    schedules: isMissingSchema(schedules.error) ? [] : (schedules.data ?? []).map((row) => ({ ...row, weekly_hours: Number(row.weekly_hours) })),
  };
}

function SettingCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="premium-card p-5">
      <p className="section-title">{title}</p>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}
