import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data: request, error } = await supabase.from("purchase_requests").select("id, request_number, title, status, needed_on, notes").eq("id", id).eq("organization_id", workspace.organization.id).maybeSingle();
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Demande d'achat" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  if (!request) notFound();
  const { data: lines } = await supabase.from("purchase_request_lines").select("id, description, quantity, unit_name, estimated_unit_price_ht").eq("request_id", id);
  return (
    <ModulePage>
      <PageHeader title={request.request_number} description={request.title} actions={<Button asChild><Link href="/achats/consultations/new">Comparer des offres</Link></Button>} />
      <p className="text-sm text-[var(--muted)]">Statut {request.status}. Besoin le {request.needed_on ?? "—"}. {request.notes}</p>
      <Table>
        <thead><tr><Th>Description</Th><Th>Quantité</Th><Th>Unité</Th><Th className="text-right">Estimé HT</Th></tr></thead>
        <tbody>
          {(lines ?? []).map((line) => (
            <tr key={line.id}><Td>{line.description}</Td><Td>{line.quantity}</Td><Td>{line.unit_name ?? "—"}</Td><Td className="text-right"><MoneyDisplay value={Number(line.estimated_unit_price_ht)} /></Td></tr>
          ))}
        </tbody>
      </Table>
    </ModulePage>
  );
}
