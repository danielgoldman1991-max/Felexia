import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryAccountForm } from "@/components/treasury/treasury-account-form";
import { createTreasuryAccount } from "@/lib/treasury-actions";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function NewTreasuryAccountPage() {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  return (
    <ModulePage>
      <PageHeader title="Nouveau compte" description="Creez une banque, une caisse ou un compte de paiement." />
      <TreasuryAccountForm action={createTreasuryAccount} fullAccess={fullAccess} />
    </ModulePage>
  );
}
