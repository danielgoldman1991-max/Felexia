import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { ThirdPartyDetail } from "@/components/tiers/third-party-detail";
import { getThirdPartyDetail } from "@/lib/third-parties";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export default async function TierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const canWrite = !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
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
        canWrite={canWrite}
      />
    </ModulePage>
  );
}
