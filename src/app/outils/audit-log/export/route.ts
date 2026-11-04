import { NextResponse } from "next/server";
import { auditCsv, loadAuditRows } from "@/lib/audit-log-query";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rows = await loadAuditRows({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    user: url.searchParams.get("user") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    table: url.searchParams.get("table") ?? undefined,
  });
  return new NextResponse(auditCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=journal-audit.csv" },
  });
}
