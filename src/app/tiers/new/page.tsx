import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ThirdPartyForm } from "@/components/tiers/third-party-form";
import { createThirdParty } from "@/lib/third-party-actions";
import { listCustomerCategories } from "@/lib/customer-categories";
import { ensureCustomerCategories } from "@/lib/actions/ensure-reference-data";
import type { ThirdPartyKind } from "@/lib/third-party-types";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function NewTierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = (fullAccess ? ["prospect", "customer", "supplier"] : ["customer", "supplier"]).includes(rawType ?? "")
    ? (rawType as ThirdPartyKind)
    : fullAccess ? undefined : "customer";

  await ensureCustomerCategories();
  const customerCategories = await listCustomerCategories();

  return (
    <ModulePage>
      <PageHeader title={fullAccess ? "Nouveau tiers" : initialType === "supplier" ? "Nouveau fournisseur" : "Nouveau client"} description="Les coordonnées utiles pour vos factures et vos règlements." />
      <ThirdPartyForm mode="create" action={createThirdParty} initialType={initialType} customerCategories={customerCategories} fullAccess={fullAccess} />
    </ModulePage>
  );
}
