import { NextResponse } from "next/server";
import { buildLiasse } from "@/lib/accounting/liasse";
import { loadAccountingLines } from "@/lib/accounting/entry-lines";
import { buildIsFile } from "@/lib/accounting/fiscal-files";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const year = Number(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
  const supabase = await createClient();
  const [loaded, organization, settings] = await Promise.all([
    loadAccountingLines(supabase, workspace.organization.id),
    supabase.from("organizations").select("ice").eq("id", workspace.organization.id).maybeSingle(),
    supabase.from("organization_fiscal_settings").select("is_rate_percent").eq("organization_id", workspace.organization.id).maybeSingle(),
  ]);
  const liasse = buildLiasse(loaded.rows.map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })), 0);
  const rate = settings.data?.is_rate_percent === null || settings.data?.is_rate_percent === undefined ? null : Number(settings.data.is_rate_percent);
  const body = buildIsFile(String(organization.data?.ice ?? ""), year, liasse.cpc.resultat, rate);
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename=is-preparatoire-${year}.txt` } });
}
