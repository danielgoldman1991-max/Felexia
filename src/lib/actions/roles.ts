"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function createRoleAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    const workspace = await requireActiveWorkspace();
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return { error: "Non autorisé." };
    }

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name) return { error: "Le nom est requis." };

    const supabase = await createClient();

    const { error } = await supabase.from("roles").insert({
      organization_id: workspace.organization.id,
      name: name.toLowerCase(),
      description: description || null,
    });

    if (error) return { error: error.message };

    await logAudit(workspace.organization.id, "create_role", "roles", undefined, { name });

    revalidatePath("/parametres/roles");
    return { error: null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function deleteRoleAction(
  roleId: string,
): Promise<{ error: string | null }> {
  try {
    const workspace = await requireActiveWorkspace();
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return { error: "Non autorisé." };
    }

    const supabase = await createClient();

    const { data: role } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .single();

    if (!role) return { error: "Rôle introuvable." };

    const systemRoles = ["owner", "admin", "commercial", "comptable", "stock", "lecture seule"];
    if (systemRoles.includes(role.name.toLowerCase())) {
      return { error: "Ce rôle est un rôle système et ne peut pas être supprimé." };
    }

    const { error } = await supabase.from("roles").delete().eq("id", roleId);

    if (error) return { error: error.message };

    await logAudit(workspace.organization.id, "delete_role", "roles", roleId, { name: role.name });

    revalidatePath("/parametres/roles");
    return { error: null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissionIds: string[],
): Promise<{ error: string | null }> {
  try {
    const workspace = await requireActiveWorkspace();
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return { error: "Non autorisé." };
    }

    const supabase = await createClient();

    await supabase.from("role_permissions").delete().eq("role_id", roleId);

    if (permissionIds.length > 0) {
      const { error } = await supabase.from("role_permissions").insert(
        permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })),
      );
      if (error) return { error: error.message };
    }

    await logAudit(workspace.organization.id, "update_role_permissions", "roles", roleId);

    revalidatePath("/parametres/roles");
    return { error: null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
