import type { SupabaseClient } from "@supabase/supabase-js";

export function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

export async function notifyOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  notice: { type: string; title: string; message: string; actionLabel?: string; actionUrl?: string; severity?: "info" | "warning" | "urgent" | "success" | "error"; metadata?: Record<string, string> },
) {
  const { error } = await supabase.from("app_notifications").insert({
    organization_id: organizationId,
    user_id: null,
    type: notice.type,
    title: notice.title,
    message: notice.message,
    action_label: notice.actionLabel ?? null,
    action_url: notice.actionUrl ?? null,
    severity: notice.severity ?? "info",
    metadata: notice.metadata ?? {},
  });
  return error;
}
