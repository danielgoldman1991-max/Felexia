import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import { buildSimplDeductionXml, simplDeductionIssues, simplDeductionZip, simplRowsFromPurchases, type SimplFilingFrequency } from "@/lib/tax/simpl-tva-xml";
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

  const regime = (declaration.vat_regime ?? "unspecified") as VatRegimeMode;
  const settings = await supabase
    .from("organization_fiscal_settings")
    .select("vat_frequency")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  const companyFrequency = settings.data?.vat_frequency;
  const frequency: SimplFilingFrequency = companyFrequency === "quarterly" || companyFrequency === "monthly"
    ? companyFrequency
    : declaration.frequency === "quarterly" || declaration.frequency === "annual_control"
      ? "quarterly"
      : "monthly";
  const data = await getDgiVatExportData({
    organizationId: workspace.organization.id,
    periodStart: declaration.period_start,
    periodEnd: declaration.period_end,
    frequency,
    generatedBy: workspace.userId,
    priorCreditMad: Number(declaration.prior_credit ?? 0),
    regime,
  });
  const line190 = roundMad(data.declarationLines.find((line) => line.code === "190")?.amountMad ?? 0);
  const rows = simplRowsFromPurchases(data.purchaseDocuments);
  const issues = simplDeductionIssues({
    fiscalId: data.organization.ifNumber,
    regime,
    periodStart: data.period.startDate,
    periodEnd: data.period.endDate,
    line190,
    rows,
  });
  if (issues.length > 0) return new NextResponse(issues.join("\n"), { status: 422 });
  const xml = buildSimplDeductionXml({
    fiscalId: data.organization.ifNumber ?? "",
    periodStart: data.period.startDate,
    frequency,
    regime,
    rows,
  });
  const zip = simplDeductionZip(xml);
  const period = data.period.startDate.slice(0, 7);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="simpl-tva-${period}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Felexia-Dgi-Transmission": "none",
    },
  });
}
