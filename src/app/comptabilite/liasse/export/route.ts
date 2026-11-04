import { NextResponse } from "next/server";
import { buildLiasse, buildLiasseExcel } from "@/lib/accounting/liasse";
import { loadAccountingLines } from "@/lib/accounting/entry-lines";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const supabase = await createClient();
  const loaded = await loadAccountingLines(supabase, workspace.organization.id);
  if (loaded.error) return new NextResponse("Export indisponible.", { status: 200 });
  const liasse = buildLiasse(loaded.rows.map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })), 0);
  return new NextResponse(buildLiasseExcel(liasse), {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": "attachment; filename=liasse-gestion.xls",
    },
  });
}
