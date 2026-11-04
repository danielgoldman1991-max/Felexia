"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HR_DELETE_CONFIRM, type HrCatalogKind } from "@/lib/hr/settings-catalog";
import { archiveHrDepartmentAction, archiveHrLeaveTypeAction, archiveHrPositionAction, archiveHrScheduleAction, deleteHrDepartmentAction, deleteHrLeaveTypeAction, deleteHrPositionAction, deleteHrScheduleAction, saveHrDepartmentAction, saveHrLeaveTypeAction, saveHrPositionAction, saveHrScheduleAction, type HrSettingState } from "@/lib/hr/settings-actions";

const initial: HrSettingState = { success: false };

export type HrCatalog = {
  departments: { id: string; name: string; code: string | null; is_active: boolean }[];
  positions: { id: string; title: string; code: string | null; department_id: string | null; is_active: boolean }[];
  leaveTypes: { id: string; name: string; code: string; is_paid: boolean; annual_entitlement_days: number | null; is_active: boolean }[];
  schedules: { id: string; name: string; weekly_hours: number; work_days: string; notes: string | null; is_active: boolean }[];
  pages?: {
    departments: CatalogPage;
    positions: CatalogPage;
    leaveTypes: CatalogPage;
    schedules: CatalogPage;
  };
};

type CatalogPage = { page: number; total: number; param: string };

export function HrSettingsEditor({ catalog, canWrite, query = {}, departmentOptions }: { catalog: HrCatalog; canWrite: boolean; query?: Record<string, string | undefined>; departmentOptions?: HrCatalog["departments"] }) {
  const departments = departmentOptions ?? catalog.departments;
  return (
    <div className="mt-6 space-y-6">
      <Section title="Départements" page={catalog.pages?.departments} query={query}>
        {catalog.departments.map((item) => <DepartmentForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <DepartmentForm canWrite /> : null}
      </Section>
      <Section title="Postes" page={catalog.pages?.positions} query={query}>
        {catalog.positions.map((item) => <PositionForm key={item.id} item={item} departments={departments} canWrite={canWrite} />)}
        {canWrite ? <PositionForm departments={departments} canWrite /> : null}
      </Section>
      <Section title="Types de congés" page={catalog.pages?.leaveTypes} query={query}>
        {catalog.leaveTypes.map((item) => <LeaveForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <LeaveForm canWrite /> : null}
      </Section>
      <Section title="Horaires de travail" page={catalog.pages?.schedules} query={query}>
        {catalog.schedules.map((item) => <ScheduleForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <ScheduleForm canWrite /> : null}
      </Section>
    </div>
  );
}

function Section({ title, children, page, query }: { title: string; children: ReactNode; page?: CatalogPage; query: Record<string, string | undefined> }) {
  const size = 20;
  const totalPages = page ? Math.max(1, Math.ceil(page.total / size)) : 1;
  const href = (next: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (page) params.set(page.param, String(next));
    const text = params.toString();
    return text ? `/rh/parametres?${text}` : "/rh/parametres";
  };
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {page && page.total > size ? <p className="text-sm text-[var(--muted)]">{page.total} éléments · page {page.page}/{totalPages}</p> : null}
      </div>
      {children}
      {page && totalPages > 1 ? (
        <div className="flex gap-2">
          {page.page > 1 ? <Button variant="secondary" asChild><Link href={href(page.page - 1)}>Page précédente</Link></Button> : null}
          {page.page < totalPages ? <Button variant="secondary" asChild><Link href={href(page.page + 1)}>Page suivante</Link></Button> : null}
        </div>
      ) : null}
    </section>
  );
}

function Result({ state, successLabel = "Enregistré." }: { state: HrSettingState; successLabel?: string }) {
  if (state.success) return <p className="text-sm text-emerald-700">{successLabel}</p>;
  if (state.error) return <p className="text-sm text-red-700">{state.error}</p>;
  return null;
}

function DepartmentForm({ item, canWrite }: { item?: HrCatalog["departments"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrDepartmentAction, initial);
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
        <label className="text-sm">Code<Input className="mt-1" name="code" defaultValue={item?.code ?? ""} disabled={!canWrite} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
        {canWrite ? <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{pending ? "Enregistrement…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
        <Result state={state} />
      </form>
      {item && canWrite ? <CatalogActions id={item.id} active={item.is_active} kind="department" /> : null}
    </div>
  );
}

function PositionForm({ item, departments, canWrite }: { item?: HrCatalog["positions"][number]; departments: HrCatalog["departments"]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrPositionAction, initial);
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto_auto] sm:items-end">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="text-sm">Intitulé<Input className="mt-1" name="title" defaultValue={item?.title ?? ""} required disabled={!canWrite} /></label>
        <label className="text-sm">Code<Input className="mt-1" name="code" defaultValue={item?.code ?? ""} disabled={!canWrite} /></label>
        <label className="text-sm">Département
          <select name="department_id" defaultValue={item?.department_id ?? ""} disabled={!canWrite} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
            <option value="">Aucun</option>
            {departments.filter((department) => department.is_active || department.id === item?.department_id).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
        {canWrite ? <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{pending ? "Enregistrement…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
        <Result state={state} />
      </form>
      {item && canWrite ? <CatalogActions id={item.id} active={item.is_active} kind="position" /> : null}
    </div>
  );
}

function LeaveForm({ item, canWrite }: { item?: HrCatalog["leaveTypes"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrLeaveTypeAction, initial);
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto_auto_auto] sm:items-end">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
        <label className="text-sm">Code<Input className="mt-1" name="code" defaultValue={item?.code ?? ""} required disabled={!canWrite} /></label>
        <label className="text-sm">Jours / an<Input className="mt-1" name="annual_entitlement_days" inputMode="decimal" defaultValue={item?.annual_entitlement_days ?? ""} disabled={!canWrite} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_paid" defaultChecked={item ? item.is_paid : true} disabled={!canWrite} /> Payé</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
        {canWrite ? <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{pending ? "Enregistrement…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
        <Result state={state} />
      </form>
      {item && canWrite ? <CatalogActions id={item.id} active={item.is_active} kind="leave" /> : null}
    </div>
  );
}

function ScheduleForm({ item, canWrite }: { item?: HrCatalog["schedules"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrScheduleAction, initial);
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_7rem_1fr_1fr_auto_auto] sm:items-end">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
        <label className="text-sm">Heures<Input className="mt-1" name="weekly_hours" inputMode="decimal" defaultValue={item?.weekly_hours ?? 44} required disabled={!canWrite} /></label>
        <label className="text-sm">Jours<Input className="mt-1" name="work_days" defaultValue={item?.work_days ?? "lundi-vendredi"} required disabled={!canWrite} /></label>
        <label className="text-sm">Notes<Input className="mt-1" name="notes" defaultValue={item?.notes ?? ""} disabled={!canWrite} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
        {canWrite ? <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{pending ? "Enregistrement…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
        <Result state={state} />
      </form>
      {item && canWrite ? <CatalogActions id={item.id} active={item.is_active} kind="schedule" /> : null}
    </div>
  );
}

const archiveAction = {
  department: archiveHrDepartmentAction,
  position: archiveHrPositionAction,
  leave: archiveHrLeaveTypeAction,
  schedule: archiveHrScheduleAction,
} as const;
const deleteAction = {
  department: deleteHrDepartmentAction,
  position: deleteHrPositionAction,
  leave: deleteHrLeaveTypeAction,
  schedule: deleteHrScheduleAction,
} as const;

function CatalogActions({ id, active, kind }: { id: string; active: boolean; kind: HrCatalogKind }) {
  return (
    <div className="flex flex-wrap gap-2 sm:col-span-full">
      {active ? <CatalogButton id={id} action={archiveAction[kind]} label="Archiver" pendingLabel="Archivage…" /> : null}
      <CatalogButton id={id} action={deleteAction[kind]} label="Supprimer" pendingLabel="Suppression…" confirm={HR_DELETE_CONFIRM[kind]} successLabel="Supprimé." />
    </div>
  );
}

function CatalogButton({ id, action, label, pendingLabel, confirm, successLabel }: { id: string; action: (state: HrSettingState, formData: FormData) => Promise<HrSettingState>; label: string; pendingLabel: string; confirm?: string; successLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} onSubmit={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={pending} aria-busy={pending}>{pending ? pendingLabel : label}</Button>
      <Result state={state} successLabel={successLabel} />
    </form>
  );
}
