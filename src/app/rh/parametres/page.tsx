import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrSettingsEditor, type HrCatalog } from "@/components/hr/hr-settings-editor";
import { canManageHrWorkspace, requireHrWorkspace } from "@/lib/hr/access";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";
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
  const workspace = await requireHrWorkspace();
  await ensureReferenceIfMissing(workspace);
  const orgId = workspace.organization.id;
  const pages = {
    departments: pageNumber(query.dept),
    positions: pageNumber(query.poste),
    leaveTypes: pageNumber(query.conge),
    schedules: pageNumber(query.horaire),
  };
  const supabase = await createClient();
  const [canWrite, catalog, settings, departmentCount, positionCount, leaveCount, scheduleCount, departmentOptions] = await Promise.all([
    canWriteHrSettings(workspace),
    loadHrCatalog(orgId, pages),
    supabase.from("hr_settings").select("default_weekly_hours, default_annual_leave_days, leave_accrual_days_per_month, cnss_enabled, ir_enabled").eq("organization_id", orgId).maybeSingle(),
    supabase.from("hr_departments").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_active", true),
    supabase.from("hr_positions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_active", true),
    supabase.from("hr_leave_types").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_active", true),
    supabase.from("hr_work_schedules").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_active", true),
    supabase.from("hr_departments").select("id, name").eq("organization_id", orgId).eq("is_active", true).order("name"),
  ]);
  const settingsRow = settings.data;
  return (
    <ModulePage>
      <PageHeader title="Paramètres RH" description="Départements, postes, types de congés et horaires. Les rubriques de paie restent préparatoires." />
      <HrPreparatoryNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SettingCard title="Départements" value={departmentCount.count ?? 0} />
        <SettingCard title="Postes" value={positionCount.count ?? 0} />
        <SettingCard title="Types de congés" value={leaveCount.count ?? 0} />
        <SettingCard title="Horaires" value={isMissingSchema(scheduleCount.error) ? 0 : scheduleCount.count ?? 0} />
        <SettingCard title="Heures hebdomadaires" value={Number(settingsRow?.default_weekly_hours ?? 44)} />
        <SettingCard title="Congés annuels" value={`${settingsRow?.default_annual_leave_days ?? 18} jours`} />
        <SettingCard title="Acquisition mensuelle" value={`${settingsRow?.leave_accrual_days_per_month ?? 1.5} jours`} />
        <SettingCard title="CNSS" value={settingsRow?.cnss_enabled ? "Activée" : "Désactivée"} />
        <SettingCard title="IR" value={settingsRow?.ir_enabled ? "Activé" : "Désactivé"} />
      </div>
      <HrSettingsEditor catalog={catalog} canWrite={canWrite} query={query} departmentOptions={(departmentOptions.data ?? []).map((item) => ({ id: item.id, name: item.name ?? "", code: null, is_active: true }))} />
    </ModulePage>
  );
}

async function ensureReferenceIfMissing(workspace: Awaited<ReturnType<typeof requireHrWorkspace>>) {
  if (!canManageHrWorkspace(workspace)) return;
  const supabase = await createClient();
  const existing = await supabase.from("hr_settings").select("organization_id").eq("organization_id", workspace.organization.id).maybeSingle();
  if (existing.data || isMissingSchema(existing.error)) return;
  await ensureHrReferenceData(supabase, workspace.organization.id);
}

async function loadHrCatalog(orgId: string, pages: { departments: number; positions: number; leaveTypes: number; schedules: number }): Promise<HrCatalog> {
  const supabase = await createClient();
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
