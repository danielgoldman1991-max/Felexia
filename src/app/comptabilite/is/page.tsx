import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { requireActiveWorkspace } from "@/lib/auth";
import { buildLiasse } from "@/lib/accounting/liasse";
import { loadAccountingLines } from "@/lib/accounting/entry-lines";
import { buildIsFile } from "@/lib/accounting/fiscal-files";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CorporateTaxPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const year = Number((await searchParams).year ?? new Date().getFullYear());
  const supabase = await createClient();
  const [loaded, settings] = await Promise.all([
    loadAccountingLines(supabase, workspace.organization.id),
    supabase.from("organization_fiscal_settings").select("is_rate_percent").eq("organization_id", workspace.organization.id).maybeSingle(),
  ]);
  const liasse = buildLiasse((loaded.rows ?? []).map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })), 0);
  const rate = settings.data?.is_rate_percent === null || settings.data?.is_rate_percent === undefined ? null : Number(settings.data.is_rate_percent);
  const turnover = (loaded.rows ?? []).filter((line) => line.accountCode.trim().startsWith("7")).reduce((sum, line) => sum + line.credit - line.debit, 0);
  const preview = buildIsFile("", year, liasse.cpc.resultat, rate, { turnover });
  return (
    <ModulePage>
      <PageHeader title="IS préparatoire" description="Le résultat comptable est lu dans les écritures. L'impôt n'est estimé que si vous avez saisi un taux. Ce n'est pas la liasse fiscale ni un dépôt." />
      <p className="text-sm">Résultat comptable <MoneyDisplay value={liasse.cpc.resultat} />. Taux {rate === null ? "non renseigné" : `${rate} %`}.</p>
      <pre className="mt-4 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">{preview}</pre>
      <p className="mt-4 text-sm">
        <a className="font-semibold text-[var(--primary)]" href={`/comptabilite/is/export?year=${year}`}>Télécharger le fichier</a>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/parametres-fiscaux">Saisir le taux</Link>
      </p>
    </ModulePage>
  );
}
