import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { PIPELINE_STAGES, forecastOpportunities, type PipelineStage } from "@/lib/sales/pipeline";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data } = await supabase.from("crm_opportunities").select("id, title, customer_name, stage, amount, expected_on").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false });
  const forecast = forecastOpportunities((data ?? []).map((row) => ({ stage: row.stage as PipelineStage, amount: Number(row.amount ?? 0) })));
  return (
    <ModulePage>
      <PageHeader title="Pipeline commercial" description={`Prévision pondérée ${forecast.weighted.toFixed(2)} MAD. Une opportunité gagnée compte à 100 %, une perdue à 0.`} actions={<Button asChild><Link href="/vente/pipeline/new">Nouvelle opportunité</Link></Button>} />
      <div className="grid gap-3 md:grid-cols-5">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.code} className="rounded-[var(--radius-lg)] border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)]">{stage.label}</p>
            <p className="font-semibold"><MoneyDisplay value={forecast.byStage[stage.code].weighted} /></p>
          </div>
        ))}
      </div>
      <Table>
        <thead><tr><Th>Affaire</Th><Th>Client</Th><Th>Étape</Th><Th className="text-right">Montant</Th><Th>Échéance</Th></tr></thead>
        <tbody>{(data ?? []).length === 0 ? <tr><Td colSpan={5}>Aucune opportunité. Créez-en une depuis une prochaine saisie ; le classement est prêt.</Td></tr> : data?.map((row) => <tr key={row.id as string}><Td>{row.title as string}</Td><Td>{(row.customer_name as string | null) ?? "—"}</Td><Td>{PIPELINE_STAGES.find((stage) => stage.code === row.stage)?.label ?? row.stage}</Td><Td className="text-right"><MoneyDisplay value={Number(row.amount)} /></Td><Td>{(row.expected_on as string | null) ?? "—"}</Td></tr>)}</tbody>
      </Table>
    </ModulePage>
  );
}
