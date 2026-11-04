import { auditActionLabel, auditTableLabel, formatAuditTimestamp } from "@/lib/audit-labels";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuditFilters = { from?: string; to?: string; user?: string; action?: string; table?: string };

export type AuditRow = {
  id: string;
  when: string;
  user: string;
  action: string;
  table: string;
  detail: string;
};

export async function loadAuditRows(filters: AuditFilters): Promise<AuditRow[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select("id, action, table_name, record_id, created_at, actor_id, changes").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false }).limit(500);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const { data } = await query;
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const withEmail = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
    const profiles = withEmail.error
      ? (await supabase.from("profiles").select("id, full_name").in("id", actorIds)).data
      : withEmail.data;
    for (const profile of profiles ?? []) {
      const record = profile as { id: string; full_name?: string | null; email?: string | null };
      names.set(record.id, record.full_name?.trim() || record.email?.trim() || "Utilisateur");
    }
  }
  const needle = (value?: string) => value?.trim().toLocaleLowerCase("fr") ?? "";
  const visible = rows.filter((row) => {
    const user = needle(filters.user);
    const action = needle(filters.action);
    const table = needle(filters.table);
    const userLabel = names.get(row.actor_id) ?? "";
    if (user && !userLabel.toLocaleLowerCase("fr").includes(user) && !String(row.actor_id ?? "").toLocaleLowerCase("fr").includes(user)) return false;
    if (action && !auditActionLabel(row.action).toLocaleLowerCase("fr").includes(action) && !String(row.action ?? "").toLocaleLowerCase("fr").includes(action)) return false;
    if (table && !auditTableLabel(row.table_name).toLocaleLowerCase("fr").includes(table) && !String(row.table_name ?? "").toLocaleLowerCase("fr").includes(table)) return false;
    return true;
  });
  return visible.map((row) => ({
    id: String(row.id),
    when: formatAuditTimestamp(row.created_at),
    user: names.get(row.actor_id) ?? "Système",
    action: auditActionLabel(row.action),
    table: auditTableLabel(row.table_name),
    detail: summarize(row.changes),
  }));
}

export function auditCsv(rows: AuditRow[]) {
  const lines = ["Date;Utilisateur;Action;Element;Detail"];
  for (const row of rows) {
    lines.push([row.when, row.user, row.action, row.table, row.detail.replaceAll(";", ",")].join(";"));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

function summarize(changes: unknown) {
  if (!changes || typeof changes !== "object") return "—";
  const record = changes as Record<string, unknown>;
  const name = record.name ?? record.full_name ?? record.email ?? record.code ?? record.title ?? record.payslip;
  return name ? String(name) : "—";
}
