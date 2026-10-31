import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { ThirdPartyDetail } from "@/components/tiers/third-party-detail";
import { getThirdPartyDetail } from "@/lib/third-parties";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function TierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const { thirdParty, contacts, addresses, attachments, activity } = await getThirdPartyDetail(id);

  if (!thirdParty) {
    notFound();
  }

  return (
    <ModulePage>
      <ThirdPartyDetail
        thirdParty={thirdParty}
        contacts={contacts}
        addresses={addresses}
        attachments={attachments}
        activity={activity}
        fullAccess={fullAccess}
      />
    </ModulePage>
  );
}
