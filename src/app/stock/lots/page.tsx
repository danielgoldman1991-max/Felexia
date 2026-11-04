import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { expiringLots } from "@/lib/stock/fifo";
import { reorderSuggestion } from "@/lib/stock/inventory";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StockLotsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: lots, error } = await supabase.from("stock_lots").select("id, lot_code, quantity, unit_cost, expires_on, product_id").eq("organization_id", workspace.organization.id).order("expires_on");
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Lots et réapprovisionnement" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  const expiring = expiringLots((lots ?? []).map((lot) => ({ quantity: Number(lot.quantity), unitCost: Number(lot.unit_cost), lot: lot.lot_code as string, expiresOn: lot.expires_on as string | null })), today);
  const { data: products } = await supabase.from("products").select("id, name, current_stock, min_stock").eq("organization_id", workspace.organization.id).eq("track_stock", true).limit(200);
  const suggestions = (products ?? []).flatMap((product) => {
    const suggestion = reorderSuggestion(Number(product.current_stock ?? 0), Number(product.min_stock ?? 0));
    return suggestion.needed ? [{ id: product.id as string, name: product.name as string, quantity: suggestion.quantity }] : [];
  });
  return (
    <ModulePage>
      <PageHeader title="Lots et réapprovisionnement" description="Les lots et les séries sont suivis à part du CMUP. Le FIFO est une option de valorisation, pas le coût enregistré par défaut." />
      <h2 className="mt-4 font-semibold">Lots à péremption atteinte</h2>
      <p className="text-sm text-[var(--muted)]">{expiring.length} lot(s) à la date du {today}.</p>
      <Table>
        <thead><tr><Th>Lot</Th><Th>Quantité</Th><Th>Péremption</Th></tr></thead>
        <tbody>{(lots ?? []).length === 0 ? <tr><Td colSpan={3}>Aucun lot.</Td></tr> : lots?.map((lot) => <tr key={lot.id as string}><Td>{lot.lot_code as string}</Td><Td>{String(lot.quantity)}</Td><Td>{(lot.expires_on as string | null) ?? "—"}</Td></tr>)}</tbody>
      </Table>
      <h2 className="mt-6 font-semibold">Suggestions de réapprovisionnement</h2>
      <Table>
        <thead><tr><Th>Article</Th><Th>Quantité à commander</Th></tr></thead>
        <tbody>{suggestions.length === 0 ? <tr><Td colSpan={2}>Aucun article sous le seuil.</Td></tr> : suggestions.map((item) => <tr key={item.id}><Td>{item.name}</Td><Td>{item.quantity}</Td></tr>)}</tbody>
      </Table>
    </ModulePage>
  );
}
