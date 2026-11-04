import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { DGI_FLOW_STEPS, dgiFlowState } from "@/lib/sales/dgi-flow";

export const dynamic = "force-dynamic";

export default async function DgiFlowPage() {
  await requireActiveWorkspace();
  const state = dgiFlowState({ hasPdf: true, hasXml: true, issued: false, transmissionConfigured: false });
  return (
    <ModulePage>
      <PageHeader title="Parcours facture électronique" description="PDF et XML peuvent être préparés puis archivés. La transmission à la DGI n'est pas ouverte." />
      <ol className="space-y-3">
        {DGI_FLOW_STEPS.map((step) => (
          <li key={step.code} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
            <p className="font-semibold">{step.label}</p>
            <p className="text-sm text-[var(--muted)]">{step.code === "transmission" ? state.reason : step.code === state.reached ? "Étape courante du socle livré." : "Étape du parcours."}</p>
          </li>
        ))}
      </ol>
    </ModulePage>
  );
}
