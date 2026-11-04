"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveHrDepartmentAction, saveHrLeaveTypeAction, saveHrPositionAction, saveHrScheduleAction, type HrSettingState } from "@/lib/hr/settings-actions";

const initial: HrSettingState = { success: false };

export type HrCatalog = {
  departments: { id: string; name: string; code: string | null; is_active: boolean }[];
  positions: { id: string; title: string; code: string | null; department_id: string | null; is_active: boolean }[];
  leaveTypes: { id: string; name: string; code: string; is_paid: boolean; annual_entitlement_days: number | null; is_active: boolean }[];
  schedules: { id: string; name: string; weekly_hours: number; work_days: string; notes: string | null; is_active: boolean }[];
};

export function HrSettingsEditor({ catalog, canWrite }: { catalog: HrCatalog; canWrite: boolean }) {
  return (
    <div className="mt-6 space-y-6">
      <Section title="Départements">
        {catalog.departments.map((item) => <DepartmentForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <DepartmentForm canWrite /> : null}
      </Section>
      <Section title="Postes">
        {catalog.positions.map((item) => <PositionForm key={item.id} item={item} departments={catalog.departments} canWrite={canWrite} />)}
        {canWrite ? <PositionForm departments={catalog.departments} canWrite /> : null}
      </Section>
      <Section title="Types de congés">
        {catalog.leaveTypes.map((item) => <LeaveForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <LeaveForm canWrite /> : null}
      </Section>
      <Section title="Horaires de travail">
        {catalog.schedules.map((item) => <ScheduleForm key={item.id} item={item} canWrite={canWrite} />)}
        {canWrite ? <ScheduleForm canWrite /> : null}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;
}

function Result({ state }: { state: HrSettingState }) {
  if (state.success) return <p className="text-sm text-emerald-700">Enregistré.</p>;
  if (state.error) return <p className="text-sm text-red-700">{state.error}</p>;
  return null;
}

function DepartmentForm({ item, canWrite }: { item?: HrCatalog["departments"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrDepartmentAction, initial);
  return (
    <form action={action} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
      <label className="text-sm">Code<Input className="mt-1" name="code" defaultValue={item?.code ?? ""} disabled={!canWrite} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
      {canWrite ? <Button type="submit" variant="secondary" disabled={pending}>{pending ? "…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
      <Result state={state} />
    </form>
  );
}

function PositionForm({ item, departments, canWrite }: { item?: HrCatalog["positions"][number]; departments: HrCatalog["departments"]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrPositionAction, initial);
  return (
    <form action={action} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 sm:grid-cols-[1fr_8rem_1fr_auto_auto] sm:items-end">
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
      {canWrite ? <Button type="submit" variant="secondary" disabled={pending}>{pending ? "…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
      <Result state={state} />
    </form>
  );
}

function LeaveForm({ item, canWrite }: { item?: HrCatalog["leaveTypes"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrLeaveTypeAction, initial);
  return (
    <form action={action} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 sm:grid-cols-[1fr_8rem_8rem_auto_auto_auto] sm:items-end">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
      <label className="text-sm">Code<Input className="mt-1" name="code" defaultValue={item?.code ?? ""} required disabled={!canWrite} /></label>
      <label className="text-sm">Jours / an<Input className="mt-1" name="annual_entitlement_days" inputMode="decimal" defaultValue={item?.annual_entitlement_days ?? ""} disabled={!canWrite} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_paid" defaultChecked={item ? item.is_paid : true} disabled={!canWrite} /> Payé</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
      {canWrite ? <Button type="submit" variant="secondary" disabled={pending}>{pending ? "…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
      <Result state={state} />
    </form>
  );
}

function ScheduleForm({ item, canWrite }: { item?: HrCatalog["schedules"][number]; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveHrScheduleAction, initial);
  return (
    <form action={action} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 sm:grid-cols-[1fr_7rem_1fr_1fr_auto_auto] sm:items-end">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label className="text-sm">Nom<Input className="mt-1" name="name" defaultValue={item?.name ?? ""} required disabled={!canWrite} /></label>
      <label className="text-sm">Heures<Input className="mt-1" name="weekly_hours" inputMode="decimal" defaultValue={item?.weekly_hours ?? 44} required disabled={!canWrite} /></label>
      <label className="text-sm">Jours<Input className="mt-1" name="work_days" defaultValue={item?.work_days ?? "lundi-vendredi"} required disabled={!canWrite} /></label>
      <label className="text-sm">Notes<Input className="mt-1" name="notes" defaultValue={item?.notes ?? ""} disabled={!canWrite} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active !== false} disabled={!canWrite} /> Actif</label>
      {canWrite ? <Button type="submit" variant="secondary" disabled={pending}>{pending ? "…" : item ? "Mettre à jour" : "Ajouter"}</Button> : null}
      <Result state={state} />
    </form>
  );
}
