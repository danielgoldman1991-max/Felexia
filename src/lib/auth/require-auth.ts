import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, requireActiveWorkspace } from "@/lib/auth";
import type { ActiveWorkspace } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function requireOrg(): Promise<ActiveWorkspace> {
  return requireActiveWorkspace();
}

export async function requirePermission(
  permissionCode: string,
): Promise<ActiveWorkspace> {
  const workspace = await requireActiveWorkspace();
  if (workspace.role === "owner") return workspace;

  const supabase = await createClient();
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("permission:permissions(code)")
    .eq("role_id", workspace.role as string);

  const perms = rolePerms?.map((rp: unknown) => {
    const p = rp as { permission: { code: string } | { code: string }[] };
    const perm = Array.isArray(p.permission) ? p.permission[0] : p.permission;
    return perm?.code;
  }) ?? [];

  if (!perms.includes(permissionCode) && workspace.role !== "admin") {
    redirect("/dashboard");
  }
  return workspace;
}
