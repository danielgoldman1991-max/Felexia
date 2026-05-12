import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { RolesPermissionMatrix } from "@/components/settings/roles-permission-matrix";

export default async function RolesSettingsPage() {
  const workspace = await requireActiveWorkspace();
  const isOwner = workspace.role === "owner" || workspace.role === "admin";

  const supabase = await createClient();

  const [rolesResult, permissionsResult, rpResult, membersResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, description, created_at")
      .eq("organization_id", workspace.organization.id)
      .order("name"),
    supabase
      .from("permissions")
      .select("id, code, description")
      .order("code"),
    supabase
      .from("role_permissions")
      .select("role_id, permission_id"),
    supabase
      .from("organization_members")
      .select("role_id, id")
      .eq("organization_id", workspace.organization.id)
      .eq("status", "active"),
  ]);

  const roles = rolesResult.data ?? [];
  const permissions = permissionsResult.data ?? [];
  const rolePermissions = rpResult.data ?? [];

  const userCountByRole: Record<string, number> = {};
  for (const m of membersResult.data ?? []) {
    const rid = m.role_id;
    if (rid) userCountByRole[rid] = (userCountByRole[rid] ?? 0) + 1;
  }

  const systemRoles = ["owner", "admin", "commercial", "comptable", "stock", "lecture seule"];

  return (
    <div>
      <PageHeader
        title="Rôles & habilitations"
        description="Gérez les droits d'accès par rôle et par module."
      />
      <RolesPermissionMatrix
        roles={roles}
        permissions={permissions}
        rolePermissions={rolePermissions}
        userCountByRole={userCountByRole}
        systemRoles={systemRoles}
        isOwner={isOwner}
        organizationId={workspace.organization.id}
      />
    </div>
  );
}
