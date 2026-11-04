import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { InventoryCountForm } from "@/app/stock/inventaire/sessions/count-form";
import { ensureInventoryCountLines } from "@/lib/stock/inventory-actions";

export const dynamic = "force-dynamic";

export default async function InventorySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const session = await supabase.from("stock_counts").select("id, count_number, status, counted_on, notes").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (isMissingSchema(session.error)) return <ModulePage><PageHeader title="Inventaire" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  if (!session.data) notFound();
  if (session.data.status !== "validated") await ensureInventoryCountLines(id).catch(() => undefined);
  const lines = await supabase.from("stock_count_lines").select("id, product_id, theoretical_quantity, counted_quantity").eq("organization_id", workspace.organization.id).eq("count_id", id);
  const productIds = (lines.data ?? []).map((line) => line.product_id as string);
  const products = productIds.length
    ? await supabase.from("products").select("id, name").eq("organization_id", workspace.organization.id).in("id", productIds)
    : { data: [] };
  const names = new Map((products.data ?? []).map((row) => [row.id, row.name]));
  return (
    <ModulePage>
      <PageHeader title={session.data.count_number as string} description={`${session.data.counted_on as string} · ${session.data.status === "validated" ? "Validée, historique figé" : "Brouillon"}`} />
      <InventoryCountForm
        countId={id}
        locked={session.data.status === "validated"}
        lines={(lines.data ?? []).map((line) => ({
          id: line.id as string,
          name: names.get(line.product_id as string) ?? "Article",
          theoretical: Number(line.theoretical_quantity ?? 0),
          counted: Number(line.counted_quantity ?? 0),
        }))}
      />
    </ModulePage>
  );
}
