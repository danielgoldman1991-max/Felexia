"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createRoleAction, deleteRoleAction, updateRolePermissionsAction } from "@/lib/actions/roles";

const MODULES = [
  { key: "dashboard", label: "Tableau de bord", perms: ["dashboard.read"] },
  { key: "clients", label: "Clients", perms: ["clients.read", "clients.create", "clients.update", "clients.delete"] },
  { key: "suppliers", label: "Fournisseurs", perms: ["suppliers.read", "suppliers.create", "suppliers.update", "suppliers.delete"] },
  { key: "items", label: "Articles", perms: ["items.read", "items.create", "items.update", "items.delete"] },
  { key: "sales", label: "Ventes", perms: ["sales.read", "sales.create_quote", "sales.validate_quote", "sales.create_invoice", "sales.validate_invoice", "sales.cancel_invoice", "sales.delete"] },
  { key: "purchases", label: "Achats", perms: ["purchases.read", "purchases.create", "purchases.validate", "purchases.cancel", "purchases.delete"] },
  { key: "stock", label: "Stock", perms: ["stock.read", "stock.adjust", "stock.transfer", "stock.inventory"] },
  { key: "treasury", label: "Trésorerie", perms: ["treasury.read", "treasury.create_payment", "treasury.validate_payment", "treasury.reconcile", "treasury.delete"] },
  { key: "accounting", label: "Comptabilité", perms: ["accounting.read", "accounting.post_entries", "accounting.edit_entries", "accounting.edit_chart_accounts", "accounting.close_period"] },
  { key: "reports", label: "Rapports", perms: ["reports.read", "reports.export"] },
  { key: "users", label: "Utilisateurs", perms: ["users.read", "users.invite", "users.update_roles", "users.disable", "users.remove"] },
  { key: "settings", label: "Paramètres", perms: ["settings.read", "settings.company_update", "settings.documents_update", "settings.security_update"] },
  { key: "billing", label: "Abonnement", perms: ["billing.read", "billing.manage"] },
];

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
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const permMap: Record<string, string> = {};
  for (const p of permissions) permMap[p.code] = p.id;

  function getRolePermIds(roleId: string): string[] {
    return rolePermissions.filter((rp) => rp.role_id === roleId).map((rp) => rp.permission_id);
  }

  function hasPerm(roleId: string, permCode: string): boolean {
    const pid = permMap[permCode];
    if (!pid) return false;
    return getRolePermIds(roleId).includes(pid);
  }

  async function saveEdit() {
    if (!editingRole) return;
    setSaving(true);
    const result = await updateRolePermissionsAction(editingRole, editPerms);
    if (!result.error) {
      setEditingRole(null);
      router.refresh();
    }
    setSaving(false);
  }

  function togglePerm(permCode: string) {
    const pid = permMap[permCode];
    if (!pid) return;
    setEditPerms((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    const form = new FormData();
    form.set("name", newRoleName.trim());
    form.set("description", newRoleDesc.trim());
    const result = await createRoleAction(form);
    if (!result.error) {
      setNewRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      router.refresh();
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm("Supprimer ce rôle ? Les utilisateurs avec ce rôle devront être réaffectés.")) return;
    const result = await deleteRoleAction(roleId);
    if (!result.error) router.refresh();
  }

  const permLabels: Record<string, string> = {};
  for (const p of permissions) {
    permLabels[p.code] = p.code.split(".").pop() ?? p.code;
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex justify-end">
          <Button onClick={() => setNewRoleOpen(!newRoleOpen)}>
            <Plus className="mr-1 h-4 w-4" /> Créer un rôle
          </Button>
        </div>
      )}

      {newRoleOpen && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Nom</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="ex: gestionnaire" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Description</label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Optionnelle" />
            </div>
            <Button onClick={handleCreateRole}>Créer</Button>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="min-w-[180px] px-3 py-2 text-left font-medium text-[var(--muted)]">Module</th>
              {roles.map((role) => (
                <th key={role.id} className="px-2 py-2 text-center">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3 text-blue-600" />
                      <span className="text-xs font-semibold capitalize">{role.name}</span>
                    </div>
                    {userCountByRole[role.id] != null && (
                      <span className="flex items-center justify-center gap-1 text-[10px] text-[var(--muted)]">
                        <Users className="h-3 w-3" />
                        {userCountByRole[role.id]}
                      </span>
                    )}
                    {isOwner && !systemRoles.includes(role.name.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => (
              <tr key={mod.key} className="border-b border-[var(--border)]/50">
                <td className="px-3 py-2.5 text-xs font-medium text-[var(--foreground)]">{mod.label}</td>
                {roles.map((role) => {
                  const hasAll = mod.perms.every((p) => hasPerm(role.id, p));
                  if (editingRole === role.id) {
                    return (
                      <td key={role.id} className="px-2 py-2 text-center">
                        {mod.perms.map((p) => (
                          <label key={p} className="block text-[10px]">
                            <input
                              type="checkbox"
                              checked={editPerms.includes(permMap[p] ?? "")}
                              onChange={() => togglePerm(p)}
                              className="mr-1"
                            />
                            {permLabels[p]}
                          </label>
                        ))}
                      </td>
                    );
                  }
                  return (
                    <td key={role.id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-block h-5 w-5 rounded-full ${
                          hasAll
                            ? "bg-green-100 text-green-700"
                            : mod.perms.some((p) => hasPerm(role.id, p))
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <svg viewBox="0 0 20 20" className="h-full w-full p-1">
                          {hasAll ? (
                            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" fill="currentColor" />
                          ) : mod.perms.some((p) => hasPerm(role.id, p)) ? (
                            <circle cx="10" cy="10" r="3" fill="currentColor" />
                          ) : (
                            <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.3" />
                          )}
                        </svg>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRole && (
        <div className="flex items-center gap-3">
          <Button onClick={saveEdit} disabled={saving}>{saving ? "Sauvegarde..." : "Enregistrer les permissions"}</Button>
          <Button variant="secondary" onClick={() => setEditingRole(null)}>Annuler</Button>
        </div>
      )}
    </div>
  );
}
