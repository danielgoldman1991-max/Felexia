import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { auditActionLabel, auditTableLabel } from "@/lib/audit-labels";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const workspace = await requireActiveWorkspace();
  const url = new URL(request.url);
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select("action, table_name, created_at, actor_id, changes").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false }).limit(1000);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  const { data } = await query;
  const lines = ["Date;Utilisateur;Action;Element;Detail"];
  for (const row of data ?? []) {
    const detail = row.changes && typeof row.changes === "object" ? JSON.stringify(row.changes).replaceAll(";", ",") : "";
    lines.push([
      new Date(row.created_at).toLocaleString("fr-MA"),
      row.actor_id ?? "",
      auditActionLabel(row.action),
      auditTableLabel(row.table_name),
      detail,
    ].join(";"));
  }
  return new NextResponse(`\uFEFF${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=journal-audit.csv" },
  });
}
