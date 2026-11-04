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

const PAGE_SIZE = 20;

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export default async function HrSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const [{ departments, positions, leaveTypes, settings }, catalog, workspace] = await Promise.all([
    getHrReferenceData(),
    loadHrCatalog({
      departments: pageNumber(query.dept),
      positions: pageNumber(query.poste),
      leaveTypes: pageNumber(query.conge),
      schedules: pageNumber(query.horaire),
    }),
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
      <HrSettingsEditor catalog={catalog} canWrite={canWrite} query={query} departmentOptions={departments.map((item) => ({ id: item.id, name: item.name ?? "", code: null, is_active: true }))} />
    </ModulePage>
  );
}

async function loadHrCatalog(pages: { departments: number; positions: number; leaveTypes: number; schedules: number }): Promise<HrCatalog> {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const windowFor = (page: number) => ({ from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 });
  const departmentsWindow = windowFor(pages.departments);
  const positionsWindow = windowFor(pages.positions);
  const leaveWindow = windowFor(pages.leaveTypes);
  const scheduleWindow = windowFor(pages.schedules);
  const [departments, positions, leaveTypes, schedules] = await Promise.all([
    supabase.from("hr_departments").select("id, name, code, is_active", { count: "exact" }).eq("organization_id", orgId).order("name").range(departmentsWindow.from, departmentsWindow.to),
    supabase.from("hr_positions").select("id, title, code, department_id, is_active", { count: "exact" }).eq("organization_id", orgId).order("title").range(positionsWindow.from, positionsWindow.to),
    supabase.from("hr_leave_types").select("id, name, code, is_paid, annual_entitlement_days, is_active", { count: "exact" }).eq("organization_id", orgId).order("name").range(leaveWindow.from, leaveWindow.to),
    supabase.from("hr_work_schedules").select("id, name, weekly_hours, work_days, notes, is_active", { count: "exact" }).eq("organization_id", orgId).order("name").range(scheduleWindow.from, scheduleWindow.to),
  ]);
  return {
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    leaveTypes: (leaveTypes.data ?? []).map((row) => ({ ...row, annual_entitlement_days: row.annual_entitlement_days == null ? null : Number(row.annual_entitlement_days) })),
    schedules: isMissingSchema(schedules.error) ? [] : (schedules.data ?? []).map((row) => ({ ...row, weekly_hours: Number(row.weekly_hours) })),
    pages: {
      departments: { page: pages.departments, total: departments.count ?? 0, param: "dept" },
      positions: { page: pages.positions, total: positions.count ?? 0, param: "poste" },
      leaveTypes: { page: pages.leaveTypes, total: leaveTypes.count ?? 0, param: "conge" },
      schedules: { page: pages.schedules, total: isMissingSchema(schedules.error) ? 0 : schedules.count ?? 0, param: "horaire" },
    },
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
