import { createClient } from "@/lib/supabase/server";

export async function logAudit(
  organizationId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: user?.id,
      table_name: entityType ?? "settings",
      record_id: entityId,
      action,
      changes: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    });
  } catch {
    // Silently fail - audit should never block the main flow
  }
}
