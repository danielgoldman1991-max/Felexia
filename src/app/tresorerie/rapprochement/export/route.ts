import { NextResponse } from "next/server";
import { hasFullErpAccess } from "@/lib/launch-access";
import { requireActiveWorkspace } from "@/lib/auth";
import { buildReconciliationExcel } from "@/lib/treasury/reconciliation-export";
import { loadExpertReconciliation } from "@/lib/treasury/reconciliation-view";

export async function GET(request: Request) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const accountId = new URL(request.url).searchParams.get("accountId") ?? undefined;
  const view = await loadExpertReconciliation(accountId);
  return new NextResponse(buildReconciliationExcel(view), {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": "attachment; filename=rapprochement-bancaire.xls",
    },
  });
}
