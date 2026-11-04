import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { PriceListForm } from "@/app/vente/prix/form";

export const dynamic = "force-dynamic";

export default async function EditPriceListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const list = await supabase.from("customer_price_lists").select("id, name, customer_id, discount_percent, active").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (isMissingSchema(list.error)) return <ModulePage><PageHeader title="Liste de prix" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  if (!list.data) notFound();
  const [items, customers, products] = await Promise.all([
    supabase.from("customer_price_list_items").select("description, unit_price, product_id").eq("organization_id", workspace.organization.id).eq("price_list_id", id),
    supabase.from("third_parties").select("id, name").eq("organization_id", workspace.organization.id).is("archived_at", null).order("name").limit(300),
    supabase.from("products").select("id, name").eq("organization_id", workspace.organization.id).is("archived_at", null).order("name").limit(300),
  ]);
  return (
    <ModulePage>
      <PageHeader title={list.data.name as string} description="Modifiez les prix HT et la remise. Une liste inactive n’est plus appliquée." />
      <PriceListForm
        customers={customers.data ?? []}
        products={products.data ?? []}
        initial={{
          id,
          name: list.data.name as string,
          customerId: (list.data.customer_id as string | null) ?? null,
          discount: Number(list.data.discount_percent ?? 0),
          active: list.data.active !== false,
          lines: (items.data ?? []).map((line) => ({ description: String(line.description ?? ""), unit_price: String(line.unit_price ?? ""), product_id: String(line.product_id ?? "") })),
        }}
      />
    </ModulePage>
  );
}
