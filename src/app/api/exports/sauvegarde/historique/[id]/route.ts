import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { BACKUP_BUCKET, backupPathBelongsTo } from "@/lib/backup/schedule";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) return new Response("Réservé au propriétaire ou à l’administrateur de l’entreprise.", { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Sauvegarde introuvable.", { status: 404 });
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("organization_backup_runs")
    .select("storage_path, status")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (!run || run.status !== "ok" || !run.storage_path || !backupPathBelongsTo(run.storage_path, workspace.organization.id)) {
    return new Response("Cette copie n’est plus disponible.", { status: 404 });
  }
  const signed = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(run.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) return new Response("Le téléchargement n’a pas pu être préparé.", { status: 404 });
  return Response.redirect(signed.data.signedUrl, 302);
}
