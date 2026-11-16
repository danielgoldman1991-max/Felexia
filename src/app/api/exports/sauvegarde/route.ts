import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { collectOrganizationBackup } from "@/lib/backup/collect";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) {
    return new Response("Réservé au propriétaire ou à l’administrateur de l’entreprise.", { status: 403 });
  }
  const supabase = await createClient();
  const includeHr = await hasFullErpAccess(workspace.organization.id);
  try {
    const backup = await collectOrganizationBackup(supabase, {
      organizationId: workspace.organization.id,
      organizationName: workspace.organization.name,
      includeHr,
    });
    const stamp = backup.manifest.createdAt.slice(0, 10);
    return new Response(new Uint8Array(backup.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="felexia-sauvegarde-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("L’export de l’entreprise a échoué. Réessayez dans un instant.", { status: 500 });
  }
}
