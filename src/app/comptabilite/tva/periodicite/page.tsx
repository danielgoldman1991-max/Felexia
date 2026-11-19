import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { VatFilingForm } from "@/components/comptabilite/tva/vat-filing-form";
import { canWriteVatWorkspace } from "@/app/comptabilite/tva/access";
import { requireActiveWorkspace } from "@/lib/auth";
import { readOrganizationVatFiling } from "@/lib/tax/vat-filing";

export const dynamic = "force-dynamic";

export default async function VatFilingPage() {
  const workspace = await requireActiveWorkspace();
  const filing = await readOrganizationVatFiling(workspace.organization.id);
  return (
    <ModulePage>
      <PageHeader title="Périodicité TVA" description="Mois ou trimestre, et régime d'exigibilité utilisés par la déclaration et le relevé SIMPL-TVA." />
      <VatFilingForm frequency={filing.frequency} regime={filing.regime} canWrite={canWriteVatWorkspace(workspace)} />
      <p className="mt-4 text-sm"><Link className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/declarations">Retour aux déclarations</Link></p>
    </ModulePage>
  );
}
