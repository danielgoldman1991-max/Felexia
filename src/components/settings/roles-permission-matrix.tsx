"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MODULE_ACCESS } from "@/lib/auth/module-catalog";
import { createRoleAction, deleteRoleAction, updateRolePermissionsAction } from "@/lib/actions/roles";

const MODULES = MODULE_ACCESS;

export function RolesPermissionMatrix({
  roles,
  permissions,
  rolePermissions,
  userCountByRole,
  systemRoles,
  isOwner,
}: {
  roles: { id: string; name: string; description: string | null; created_at: string }[];
  permissions: { id: string; code: string; description: string | null }[];
  rolePermissions: { role_id: string; permission_id: string }[];
  userCountByRole: Record<string, number>;
  systemRoles: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const role of roles) {
      initial[role.id] = rolePermissions.filter((link) => link.role_id === role.id).map((link) => link.permission_id);
    }
    return initial;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const byCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const missing = MODULES.some((module) => !byCode.has(`${module.key}.read`) || !byCode.has(`${module.key}.write`));

  function toggle(roleId: string, code: string) {
    const id = byCode.get(code);
    if (!id || !isOwner) return;
    setDraft((current) => {
      const list = current[roleId] ?? [];
      const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
      if (code.endsWith(".write") && next.includes(id)) {
        const readId = byCode.get(code.replace(/\.write$/, ".read"));
        if (readId && !next.includes(readId)) next.push(readId);
      }
      return { ...current, [roleId]: next };
    });
  }

  async function save(roleId: string) {
    setSaving(roleId);
    setError(null);
    const result = await updateRolePermissionsAction(roleId, draft[roleId] ?? []);
    setSaving(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleCreateRole() {
    setError(null);
    const form = new FormData();
    form.set("name", newRoleName.trim());
    form.set("description", newRoleDesc.trim());
    const result = await createRoleAction(form);
    if (result.error) setError(result.error);
    else {
      setNewRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {missing ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Les droits lecture/écriture attendent la migration 139. La matrice restera vide tant qu’elle n’est pas appliquée.</p> : null}
      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {isOwner ? <div className="flex justify-end"><Button onClick={() => setNewRoleOpen(!newRoleOpen)}><Plus className="mr-1 h-4 w-4" />Créer un rôle</Button></div> : null}
      {newRoleOpen ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-sm">Nom<Input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Gestionnaire" /></label>
            <label className="text-sm">Description<Input value={newRoleDesc} onChange={(event) => setNewRoleDesc(event.target.value)} placeholder="Ce texte suit le rôle dans l’invitation" /></label>
            <Button type="button" onClick={handleCreateRole}>Créer</Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-2 text-left">Module</th>
              {roles.map((role) => (
                <th key={role.id} className="px-3 py-2 text-center">
                  <span className="block font-semibold">{role.name}</span>
                  <span className="block text-xs text-[var(--muted)]">{userCountByRole[role.id] ?? 0} utilisateur(s)</span>
                  {role.description ? <span className="block text-xs text-[var(--muted)]">{role.description}</span> : null}
                  {isOwner && !systemRoles.includes(role.name.toLowerCase()) ? <button type="button" className="mt-1 text-red-600" onClick={() => deleteRoleAction(role.id).then(() => router.refresh())}><Trash2 className="h-3 w-3" /></button> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module.key} className="border-b border-[var(--border)]">
                <td className="px-3 py-3 font-medium">{module.label}</td>
                {roles.map((role) => {
                  const readId = byCode.get(`${module.key}.read`);
                  const writeId = byCode.get(`${module.key}.write`);
                  const selected = draft[role.id] ?? [];
                  return (
                    <td key={role.id} className="px-3 py-2 text-center">
                      <label className="mr-3 inline-flex items-center gap-1 text-xs">
                        <input type="checkbox" disabled={!isOwner || !readId} checked={Boolean(readId && selected.includes(readId))} onChange={() => toggle(role.id, `${module.key}.read`)} />
                        Lecture
                      </label>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input type="checkbox" disabled={!isOwner || !writeId} checked={Boolean(writeId && selected.includes(writeId))} onChange={() => toggle(role.id, `${module.key}.write`)} />
                        Écriture
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
            {isOwner ? (
              <tr>
                <td />
                {roles.map((role) => (
                  <td key={role.id} className="px-3 py-3 text-center">
                    <Button type="button" className="h-8" disabled={saving === role.id} onClick={() => save(role.id)}>{saving === role.id ? "Enregistrement…" : "Enregistrer"}</Button>
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
