import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SettingsForm } from "@/components/accounting/settings-form";
import { getAccountingSettings } from "@/lib/accounting-actions";
import { updateAccountingSettings } from "@/lib/accounting-actions";

export default async function AccountingSettingsPage() {
  const result = await getAccountingSettings();
  const settings = result.success && result.data
    ? result.data as import("@/lib/accounting-types").AccountingSettingsRecord
    : null;

  return (
    <ModulePage>
      <PageHeader title="Parametres comptables" description="Configuration des journaux, comptes par defaut et numerotation." />
      <SettingsForm
        action={updateAccountingSettings}
        settings={settings}
      />
    </ModulePage>
  );
}
