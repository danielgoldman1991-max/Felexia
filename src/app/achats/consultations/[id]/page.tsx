import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { rankSupplierQuotes } from "@/lib/purchases/rfq";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchaseRfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data: rfq, error } = await supabase.from("purchase_rfqs").select("id, rfq_number, title, status, awarded_quote_id").eq("id", id).eq("organization_id", workspace.organization.id).maybeSingle();
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Consultation" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  if (!rfq) notFound();
  const { data: quotes } = await supabase.from("purchase_rfq_quotes").select("id, supplier_name, total_ht, total_ttc, lead_days").eq("rfq_id", id);
  const ranked = rankSupplierQuotes((quotes ?? []).map((quote) => ({
    id: quote.id as string,
    supplier: quote.supplier_name as string,
    totalHt: Number(quote.total_ht),
    totalTtc: Number(quote.total_ttc),
    leadDays: Number(quote.lead_days),
  })));
  return (
    <ModulePage>
      <PageHeader title={rfq.rfq_number} description={`${rfq.title} — ${rfq.status}`} />
      <Table>
        <thead><tr><Th>Rang</Th><Th>Fournisseur</Th><Th className="text-right">HT</Th><Th className="text-right">TTC</Th><Th>Délai</Th><Th>Décision</Th></tr></thead>
        <tbody>
          {ranked.map((quote) => (
            <tr key={quote.id}>
              <Td>{quote.rank}</Td>
              <Td>{quote.supplier}</Td>
              <Td className="text-right"><MoneyDisplay value={quote.totalHt} /></Td>
              <Td className="text-right"><MoneyDisplay value={quote.totalTtc} /></Td>
              <Td>{quote.leadDays} j</Td>
              <Td>{quote.id === rfq.awarded_quote_id || quote.recommended ? "Recommandée" : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ModulePage>
  );
}
