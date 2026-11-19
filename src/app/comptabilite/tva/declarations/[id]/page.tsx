import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { VatDeclarationDetail } from "@/components/comptabilite/tva/vat-declaration-detail";
import { getVatDeclarationById } from "@/lib/tax/vat-declarations";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteVatWorkspace } from "@/app/comptabilite/tva/access";
import type { SimplDeductionIssue } from "@/lib/tax/simpl-tva-xml";
import type { VatRegimeMode } from "@/lib/tax/vat-period-rules";

export const dynamic = "force-dynamic";

export default async function VatDeclarationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [declaration, workspace] = await Promise.all([getVatDeclarationById(id), requireActiveWorkspace()]);
  if (!declaration) notFound();
  let simplIssues: SimplDeductionIssue[] = [];
  let simplWarnings: SimplDeductionIssue[] = [];
  try {
    const { prepareSimplDeductionExport } = await import("@/lib/tax/simpl-tva-export");
    const preview = await prepareSimplDeductionExport({
      organizationId: workspace.organization.id,
      userId: workspace.userId,
      periodStart: declaration.period_start,
      periodEnd: declaration.period_end,
      declarationFrequency: declaration.frequency,
      regime: (declaration.vat_regime ?? "unspecified") as VatRegimeMode,
      priorCredit: Number(declaration.prior_credit ?? 0),
    });
    simplIssues = preview.issues;
    simplWarnings = preview.warnings;
  } catch (error) {
    console.error("[simpl-tva] preview failed", error instanceof Error ? error.message : "unknown");
  }
  return (
    <ModulePage>
      <VatDeclarationDetail declaration={declaration} canWrite={canWriteVatWorkspace(workspace)} simplIssues={simplIssues} simplWarnings={simplWarnings} />
    </ModulePage>
  );
}
