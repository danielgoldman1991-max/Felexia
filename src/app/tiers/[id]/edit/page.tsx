import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ThirdPartyForm } from "@/components/tiers/third-party-form";
import { updateThirdParty } from "@/lib/third-party-actions";
import { getThirdParty } from "@/lib/third-parties";
import { listCustomerCategories } from "@/lib/customer-categories";

export default async function EditThirdPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { thirdParty } = await getThirdParty(id);

  if (!thirdParty) {
    notFound();
  }

  const customerCategories = await listCustomerCategories();

  return (
    <ModulePage>
      <PageHeader title="Modifier tiers" description={thirdParty.name} />
      <ThirdPartyForm mode="edit" thirdParty={thirdParty} action={updateThirdParty} customerCategories={customerCategories} />
    </ModulePage>
  );
}
