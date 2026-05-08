import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { ThirdPartyDetail } from "@/components/tiers/third-party-detail";
import { getThirdPartyDetail } from "@/lib/third-parties";

export default async function TierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { thirdParty, contacts, addresses } = await getThirdPartyDetail(id);

  if (!thirdParty) {
    notFound();
  }

  return (
    <ModulePage>
      <ThirdPartyDetail thirdParty={thirdParty} contacts={contacts} addresses={addresses} />
    </ModulePage>
  );
}
