"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type Role = { id: string; name: string; description: string | null };
type Permission = { id: string; code: string; description: string | null };
type RolePermission = { role_id: string; permission_id: string };

type EditState = { error: string | null };

export function PermissionEditor({
  roles,
  permissions,
  rolePermissions,
}: {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
}) {
  const router = useRouter();

  async function saveAction(_prev: EditState, formData: FormData): Promise<EditState> {
    const roleId = String(formData.get("roleId") ?? "");
    const permissionIds = formData.getAll("permissionIds").map(String);

    try {
      const res = await fetch("/api/roles/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, permissionIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { error: data.error || "Erreur lors de la mise a jour." };
      }
      router.refresh();
      return { error: null };
    } catch {
      return { error: "Erreur reseau." };
    }
  }

  const [state, formAction, pending] = useActionState(saveAction, { error: null });

  return (
    <form action={formAction} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-3 font-semibold">Modifier les permissions</h3>
      <div className="mb-4">
        <label htmlFor="edit-role" className="mb-1 block text-xs font-medium text-[var(--secondary)]">
          Role
        </label>
        <select
          id="edit-role"
          name="roleId"
          className="block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {permissions.map((perm) => (
          <label key={perm.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="permissionIds"
              value={perm.id}
              defaultChecked={rolePermissions.some((rp) => rp.permission_id === perm.id)}
              className="rounded border-[var(--border)]"
            />
            <span title={perm.description ?? undefined}>{perm.code}</span>
          </label>
        ))}
      </div>
      {state.error && (
        <p className="mb-3 text-sm text-red-600">{state.error}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
