import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { FiscalSettingsForm } from "@/components/accounting/fiscal-settings-form";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isMissingRelation } from "@/lib/hr/notify";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FiscalSettingsPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_fiscal_settings").select("cnss_affiliation, vat_frequency, is_rate_percent, activity_code, filing_note").eq("organization_id", workspace.organization.id).maybeSingle();
  const settings = {
    cnss_affiliation: data?.cnss_affiliation ?? null,
    vat_frequency: data?.vat_frequency ?? "monthly",
    is_rate_percent: data?.is_rate_percent === null || data?.is_rate_percent === undefined ? null : Number(data.is_rate_percent),
    activity_code: data?.activity_code ?? null,
    filing_note: data?.filing_note ?? null,
  };
  return (
    <ModulePage>
      <PageHeader title="Paramètres de dépôt" description="Identifiants utiles aux fichiers à téléverser. Aucun mot de passe DGI ou Damancom n'est demandé, et aucun dépôt n'est envoyé." />
      {isMissingRelation(error) ? <p className="mb-4 text-sm text-[var(--muted)]">La migration 124 n&apos;est pas encore appliquée. Vous pouvez déjà télécharger les fichiers préparatoires.</p> : null}
      <FiscalSettingsForm settings={settings} />
      <p className="mt-4 text-sm">
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/edi-simpl">SIMPL TVA</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/is">IS préparatoire</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/rh/cnss">Bordereau CNSS</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/rh/ir">État 9421</Link>
      </p>
    </ModulePage>
  );
}
