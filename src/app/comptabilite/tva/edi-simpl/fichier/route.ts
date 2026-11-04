import { NextResponse } from "next/server";
import { buildEdiSimpl } from "@/lib/accounting/edi-simpl";
import { controlTrailer, declarationToSimplLines, validateSimpl } from "@/lib/accounting/fiscal-files";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import { createClient } from "@/lib/supabase/server";

function requestedPeriod(url: URL) {
  const periode = url.searchParams.get("periode") ?? "";
  const match = /^(\d{4})-(\d{2})$/.exec(periode);
  const now = new Date();
  const year = Number(match?.[1] ?? url.searchParams.get("year") ?? now.getFullYear());
  const month = Number(match?.[2] ?? url.searchParams.get("month") ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month, period: `${year}${String(month).padStart(2, "0")}` };
}

export async function GET(request: Request) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const selected = requestedPeriod(new URL(request.url));
  if (!selected) return new NextResponse("Période attendue au format YYYY-MM.", { status: 400 });
  const { year, month, period } = selected;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data: settings } = await supabase.from("organization_fiscal_settings").select("vat_frequency").eq("organization_id", workspace.organization.id).maybeSingle();
  const frequency = settings?.vat_frequency === "quarterly" ? "quarterly" : "monthly";
  let lines = declarationToSimplLines([]);
  let ice = "";
  try {
    const data = await getDgiVatExportData({ organizationId: workspace.organization.id, periodStart: start, periodEnd: end, frequency, generatedBy: workspace.userId });
    ice = data.organization.ice ?? "";
    lines = declarationToSimplLines(data.declarationLines);
  } catch {
    const { data: org } = await supabase.from("organizations").select("ice").eq("id", workspace.organization.id).maybeSingle();
    ice = String(org?.ice ?? "");
  }
  if (!lines.some((line) => line.code === "092")) lines = [...lines, { code: "092", base: 0, tax: 0 }];
  const { data: identity } = await supabase.from("organizations").select("if_number").eq("id", workspace.organization.id).maybeSingle();
  const issues = validateSimpl(ice, period, lines);
  const body = `${buildEdiSimpl(ice, period, lines, identity?.if_number)}${controlTrailer(issues)}`;
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename=edi-simpl-${period}.txt` } });
}
