import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { buildLiasse } from "@/lib/accounting/liasse";
import { loadAccountingLines } from "@/lib/accounting/entry-lines";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const sectionTitle = { actif: "Bilan — actif", passif: "Bilan — passif", cpc: "CPC", esg: "ESG", annexe: "Annexe TVA" } as const;

export default async function LiassePage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const loaded = await loadAccountingLines(supabase, workspace.organization.id);
  if (loaded.error) return <ModulePage><PageHeader title="Liasse de gestion" description="Les écritures ne sont pas lisibles pour le moment. La liasse reste vide et le reste de l'application fonctionne." /></ModulePage>;
  const liasse = buildLiasse(loaded.rows.map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })), 0);
  const sections = ["actif", "passif", "cpc", "esg", "annexe"] as const;
  return (
    <ModulePage>
      <PageHeader title="Liasse de gestion CGNC" description="Bilan, CPC, ESG et annexe TVA issus des écritures. Ce n'est pas une liasse certifiée ni un dépôt fiscal." />
      <p className="text-sm">
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/liasse/print">Imprimer</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/liasse/export">Excel</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/fec">Export de type FEC</Link>
        {" · "}
        <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/edi-simpl">EDI SIMPL</Link>
      </p>
      {loaded.truncated ? <p className="text-sm text-[var(--muted)]">Lecture limitée aux 20 000 premières lignes.</p> : null}
      <div className="mt-4 grid gap-4">
        {sections.map((section) => {
          const rows = liasse.postes.filter((poste) => poste.section === section);
          if (rows.length === 0) return null;
          return (
            <section key={section} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="font-semibold">{sectionTitle[section]}</h2>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {rows.map((poste) => (
                  <li key={`${poste.section}-${poste.code}`} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span>{poste.code} · {poste.label}</span>
                    <span className="font-medium tabular-nums"><MoneyDisplay value={poste.amount} /></span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-sm">{liasse.bilan.balanced ? "Actif et passif sont équilibrés." : "Actif et passif ne s'équilibrent pas. Vérifiez les écritures hors classes 1 à 7."} Variation de trésorerie <MoneyDisplay value={liasse.financement.variation} />.</p>
    </ModulePage>
  );
}
