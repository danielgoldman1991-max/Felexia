import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeCump, type CumpMovement } from "@/lib/stock/cump";

export const dynamic = "force-dynamic";

export default async function StockValuationPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const productsResult = await supabase.from("products").select("id, name, purchase_price_ht, track_stock").eq("organization_id", workspace.organization.id).eq("track_stock", true);
  const movesWithCost = await supabase.from("stock_moves").select("product_id, direction, quantity, movement_date, unit_cost").eq("organization_id", workspace.organization.id).order("movement_date");
  const movesResult = movesWithCost.error?.code === "42703"
    ? await supabase.from("stock_moves").select("product_id, direction, quantity, movement_date").eq("organization_id", workspace.organization.id).order("movement_date")
    : movesWithCost;
  const movesByProduct = new Map<string, CumpMovement[]>();
  for (const move of movesResult.data ?? []) {
    const list = movesByProduct.get(move.product_id as string) ?? [];
    const rawCost = (move as { unit_cost?: number | string | null }).unit_cost;
    const unitCost = rawCost == null || rawCost === "" ? null : Number(rawCost);
    list.push({ direction: move.direction === "out" ? "out" : "in", quantity: Number(move.quantity), unitCost: Number.isFinite(unitCost) ? unitCost : null });
    movesByProduct.set(move.product_id as string, list);
  }
  const rows = (productsResult.data ?? []).map((product) => {
    const purchase = Number(product.purchase_price_ht ?? 0);
    const moves = (movesByProduct.get(product.id as string) ?? []).map((move) => (
      move.direction === "in" && (move.unitCost == null || !Number.isFinite(move.unitCost)) ? { ...move, unitCost: purchase } : move
    ));
    return { name: product.name as string, ...computeCump(moves), purchase };
  });
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <ModulePage>
      <PageHeader title="Valorisation CMUP" description="Coût moyen pondéré à partir des mouvements et du prix d'achat enregistré. Les lots, séries et le FIFO ne sont pas suivis." />
      <div className="overflow-x-auto">
        <Table>
          <thead><tr><Th>Article</Th><Th className="text-right">Quantité</Th><Th className="text-right">CMUP</Th><Th className="text-right">Valeur</Th><Th>Alerte</Th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><Td colSpan={5}>Aucun article suivi en stock.</Td></tr> : rows.map((row) => (
              <tr key={row.name}>
                <Td>{row.name}</Td>
                <Td className="text-right tabular-nums">{row.quantity.toLocaleString("fr-MA")}</Td>
                <Td className="text-right"><MoneyDisplay value={row.averageCost} /></Td>
                <Td className="text-right"><MoneyDisplay value={row.value} /></Td>
                <Td>{row.negativeAttempt ? "Sortie au-delà du stock disponible" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p className="mt-3 text-sm font-semibold">Valeur totale <MoneyDisplay value={total} /></p>
    </ModulePage>
  );
}
