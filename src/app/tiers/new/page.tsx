import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ThirdPartyForm } from "@/components/tiers/third-party-form";
import { createThirdParty } from "@/lib/third-party-actions";
import { listCustomerCategories } from "@/lib/customer-categories";
import type { ThirdPartyKind } from "@/lib/third-party-types";

export default async function NewTierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = ["prospect", "customer", "supplier"].includes(rawType ?? "")
    ? (rawType as ThirdPartyKind)
    : undefined;

  const customerCategories = await listCustomerCategories();

  return (
    <ModulePage>
      <PageHeader title="Nouveau tiers" description="Creation prospect, client, fournisseur ou tiers mixte." />
      <ThirdPartyForm mode="create" action={createThirdParty} initialType={initialType} customerCategories={customerCategories} />
    </ModulePage>
  );
}
