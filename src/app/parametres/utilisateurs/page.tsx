import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { MembersFullList } from "@/components/settings/members-full-list";
import { checkUserLimit } from "@/lib/permissions";

export default async function UsersSettingsPage() {
  const workspace = await requireActiveWorkspace();
  const isOwner = workspace.role === "owner" || workspace.role === "admin";

  const supabase = await createClient();

  const [membersResult, invitationsResult, rolesResult, limit] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, status, created_at, role:roles(name), profile:profiles(full_name, email)")
      .eq("organization_id", workspace.organization.id)
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, full_name, token, status, created_at, expires_at, role:roles(name)")
      .eq("organization_id", workspace.organization.id)
      .order("created_at"),
    supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", workspace.organization.id)
      .order("name"),
    checkUserLimit(),
  ]);

  const members = (membersResult.data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    status: m.status,
    fullName: (m.profile as unknown as { full_name: string | null })?.full_name ?? null,
    email: (m.profile as unknown as { email: string | null })?.email ?? null,
    role: (m.role as unknown as { name: string } | null)?.name ?? null,
  }));

  const invitations = (invitationsResult.data ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    fullName: inv.full_name,
    status: inv.status,
    token: inv.token,
    role: (inv.role as unknown as { name: string } | null)?.name ?? null,
    createdAt: inv.created_at,
    expiresAt: inv.expires_at,
  }));

  const roles = (rolesResult.data ?? []).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description={`Gérez les membres de l'organisation. ${limit.allowed ? "" : `Limite atteinte (${limit.current}/${limit.max}).`}`}
      />
      <MembersFullList
        members={members}
        invitations={invitations}
        roles={roles}
        isOwner={isOwner}
        organizationId={workspace.organization.id}
        currentUserId={workspace.userId}
        limit={limit}
      />
    </div>
  );
}
