import { createClient } from "@/lib/supabase/server";
import type { ActiveWorkspace } from "@/lib/auth";
import { MODULE_ACCESS, type ModuleKey } from "@/lib/auth/module-catalog";
import { isAdminRole } from "@/lib/auth/roles";

export { MODULE_ACCESS, type ModuleKey };

const ADMIN_NAMES = new Set(["owner", "admin", "administrateur", "proprietaire", "propriétaire"]);

export function isBuiltInAdminRole(role: string | null | undefined) {
  return ADMIN_NAMES.has((role ?? "").trim().toLowerCase()) || isAdminRole(role);
}

/** True when the member's role has the module right. Administrators always pass. */
export async function hasModulePermission(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  if (isBuiltInAdminRole(workspace.role)) return true;
  const supabase = await createClient();
  const membership = await supabase
    .from("organization_members")
    .select("role_id")
    .eq("organization_id", workspace.organization.id)
    .eq("user_id", workspace.userId)
    .eq("status", "active")
    .maybeSingle();
  const roleId = membership.data?.role_id as string | undefined;
  if (!roleId) return false;
  const links = await supabase
    .from("role_permissions")
    .select("permission:permissions(code)")
    .eq("role_id", roleId);
  if (links.error) return isBuiltInAdminRole(workspace.role);
  const codes = new Set((links.data ?? []).map((row) => {
    const permission = row.permission as { code?: string } | { code?: string }[] | null;
    const value = Array.isArray(permission) ? permission[0] : permission;
    return value?.code ?? "";
  }));
  if (level === "read") return codes.has(`${module}.read`) || codes.has(`${module}.write`);
  return codes.has(`${module}.write`);
}

export async function assertModulePermission(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  if (await hasModulePermission(workspace, module, level)) return;
  throw new Error(level === "write"
    ? `Votre rôle ne permet pas de modifier le module ${MODULE_ACCESS.find((item) => item.key === module)?.label ?? module}.`
    : `Votre rôle ne permet pas de consulter le module ${MODULE_ACCESS.find((item) => item.key === module)?.label ?? module}.`);
}
