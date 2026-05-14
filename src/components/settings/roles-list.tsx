"use client";

import { Shield } from "lucide-react";

type Role = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Permission = {
  id: string;
  code: string;
  description: string | null;
};

type RolePermission = {
  role_id: string;
  permission_id: string;
};

export function RolesList({
  roles,
  permissions,
  rolePermissions,
}: {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
}) {
  return (
    <div className="space-y-4">
      {roles.map((role) => {
        const rolePermIds = rolePermissions
          .filter((rp) => rp.role_id === role.id)
          .map((rp) => rp.permission_id);

        const rolePerms = permissions.filter((p) => rolePermIds.includes(p.id));

        return (
          <div
            key={role.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold capitalize">{role.name}</h3>
              {role.description && (
                <span className="text-sm text-[var(--muted)]">— {role.description}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {rolePerms.length === 0 ? (
                <span className="text-xs text-[var(--muted)]">Aucune permission</span>
              ) : (
                rolePerms.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {p.code}
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
