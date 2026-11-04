import { createClient } from "@/lib/supabase/server";
import type { ActiveWorkspace } from "@/lib/auth";
import { decideModuleAccess, MODULE_ACCESS, type ModuleKey } from "@/lib/auth/module-catalog";
import { isAdminRole } from "@/lib/auth/roles";

export { MODULE_ACCESS, type ModuleKey };

const ADMIN_NAMES = new Set(["owner", "admin", "administrateur", "proprietaire", "propriétaire"]);

export function isBuiltInAdminRole(role: string | null | undefined) {
  return ADMIN_NAMES.has((role ?? "").trim().toLowerCase()) || isAdminRole(role);
}

async function rolePermissionCodes(workspace: ActiveWorkspace) {
  const supabase = await createClient();
  const membership = await supabase
    .from("organization_members")
    .select("role_id")
    .eq("organization_id", workspace.organization.id)
    .eq("user_id", workspace.userId)
    .eq("status", "active")
    .maybeSingle();
  const roleId = membership.data?.role_id as string | undefined;
  if (!roleId) return { codes: [] as string[], missingRole: true };
  const links = await supabase
    .from("role_permissions")
    .select("permission:permissions(code)")
    .eq("role_id", roleId);
  if (links.error) return { codes: [] as string[], missingRole: false, failed: true };
  const codes = (links.data ?? []).map((row) => {
    const permission = row.permission as { code?: string } | { code?: string }[] | null;
    const value = Array.isArray(permission) ? permission[0] : permission;
    return value?.code ?? "";
  }).filter(Boolean);
  return { codes, missingRole: false, failed: false };
}

export async function modulePermissionDecision(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  if (isBuiltInAdminRole(workspace.role)) return "allow" as const;
  const loaded = await rolePermissionCodes(workspace);
  if (loaded.failed) return "legacy" as const;
  if (loaded.missingRole) return "deny" as const;
  return decideModuleAccess(workspace.role, loaded.codes, module, level);
}

/** True when the member's role has the module right. Administrators always pass. An empty matrix keeps the legacy role checks. */
export async function hasModulePermission(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  const decision = await modulePermissionDecision(workspace, module, level);
  return decision !== "deny";
}

export async function moduleAccessError(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  const decision = await modulePermissionDecision(workspace, module, level);
  if (decision !== "deny") return null;
  const label = MODULE_ACCESS.find((item) => item.key === module)?.label ?? module;
  return level === "write"
    ? `Votre rôle ne permet pas de modifier le module ${label}.`
    : `Votre rôle ne permet pas de consulter le module ${label}.`;
}

/** One query. Allowed when any listed module is granted, or when the role has no matrix and keeps the legacy checks. */
export async function moduleAccessErrorAny(workspace: ActiveWorkspace, modules: ModuleKey[], level: "read" | "write") {
  if (isBuiltInAdminRole(workspace.role)) return null;
  const loaded = await rolePermissionCodes(workspace);
  if (loaded.failed) return null;
  if (!loaded.missingRole) {
    const decisions = modules.map((module) => decideModuleAccess(workspace.role, loaded.codes, module, level));
    if (decisions.some((decision) => decision === "allow" || decision === "legacy")) return null;
  }
  return level === "write"
    ? "Votre rôle ne permet pas de modifier ce module."
    : "Votre rôle ne permet pas de consulter ce module.";
}

/**
 * null when the write may proceed.
 * "legacy" when the role has no module codes and the previous role rule refused it.
 * A French sentence when the matrix refuses the write.
 */
export async function enforceModuleWrite(workspace: ActiveWorkspace, module: ModuleKey, legacyAllowed: boolean) {
  const decision = await modulePermissionDecision(workspace, module, "write");
  if (decision === "allow") return null;
  if (decision === "legacy") return legacyAllowed ? null : "legacy";
  return moduleAccessError(workspace, module, "write");
}

export async function assertModulePermission(workspace: ActiveWorkspace, module: ModuleKey, level: "read" | "write") {
  if (await hasModulePermission(workspace, module, level)) return;
  throw new Error(level === "write"
    ? `Votre rôle ne permet pas de modifier le module ${MODULE_ACCESS.find((item) => item.key === module)?.label ?? module}.`
    : `Votre rôle ne permet pas de consulter le module ${MODULE_ACCESS.find((item) => item.key === module)?.label ?? module}.`);
}
