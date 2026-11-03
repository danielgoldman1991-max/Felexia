import { NextResponse } from "next/server";
import { buildEdiSimpl } from "@/lib/accounting/edi-simpl";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("ice").eq("id", workspace.organization.id).maybeSingle();
  const period = new Date().toISOString().slice(0, 7).replace("-", "");
  const body = buildEdiSimpl(String(org?.ice ?? ""), period, []);
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename=edi-simpl-${period}.txt` } });
}
