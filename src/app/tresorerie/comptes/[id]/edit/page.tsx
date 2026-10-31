import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryAccountForm } from "@/components/treasury/treasury-account-form";
import { updateTreasuryAccount } from "@/lib/treasury-actions";
import { getTreasuryAccountDetail } from "@/lib/treasury";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function EditTreasuryAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const { account } = await getTreasuryAccountDetail(id);
  return (
    <ModulePage>
      <PageHeader title="Modifier compte" description="Mettez a jour les informations de ce compte de tresorerie." />
      <TreasuryAccountForm account={account} action={updateTreasuryAccount} fullAccess={fullAccess} />
    </ModulePage>
  );
}
