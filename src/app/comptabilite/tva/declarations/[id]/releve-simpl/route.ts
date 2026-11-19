import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { formatSimplDeductionIssues, simplDeductionZip } from "@/lib/tax/simpl-tva-xml";
import { prepareSimplDeductionExport } from "@/lib/tax/simpl-tva-export";
import type { VatRegimeMode } from "@/lib/tax/vat-period-rules";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const workspace = await requireActiveWorkspace();
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: declaration } = await supabase
    .from("vat_declarations")
    .select("id, period_start, period_end, frequency, vat_regime, prior_credit")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (!declaration) return new NextResponse("Déclaration introuvable.", { status: 404 });

  const prepared = await prepareSimplDeductionExport({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    periodStart: declaration.period_start,
    periodEnd: declaration.period_end,
    declarationFrequency: declaration.frequency,
    regime: (declaration.vat_regime ?? "unspecified") as VatRegimeMode,
    priorCredit: Number(declaration.prior_credit ?? 0),
  });
  if (prepared.issues.length > 0 || !prepared.xml) {
    return new NextResponse(formatSimplDeductionIssues(prepared.issues), {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const zip = simplDeductionZip(prepared.xml);
  const period = prepared.periodStart.slice(0, 7);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="simpl-tva-${period}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Felexia-Dgi-Transmission": "none",
    },
  });
}
