import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryAccountForm } from "@/components/treasury/treasury-account-form";
import { createTreasuryAccount } from "@/lib/treasury-actions";

export const dynamic = "force-dynamic";

export default function NewTreasuryAccountPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouveau compte" description="Creez une banque, une caisse ou un compte de paiement." />
      <TreasuryAccountForm action={createTreasuryAccount} />
    </ModulePage>
  );
}
