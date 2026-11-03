import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { buildLiasse } from "@/lib/accounting/liasse";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LiassePage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data } = await supabase.from("accounting_entry_lines").select("account_code, debit, credit").eq("organization_id", workspace.organization.id).limit(5000);
  const liasse = buildLiasse((data ?? []).map((line) => ({
    accountCode: String(line.account_code ?? ""),
    debit: Number(line.debit ?? 0),
    credit: Number(line.credit ?? 0),
  })), 0);
  return (
    <ModulePage>
      <PageHeader title="Liasse préparatoire" description="Bilan, CPC, ESG et tableau de financement à partir des écritures. Ce n'est pas une liasse certifiée." />
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4"><h2 className="font-semibold">Bilan</h2><p>Actif <MoneyDisplay value={liasse.bilan.actif} /> · Passif <MoneyDisplay value={liasse.bilan.passif} /> · {liasse.bilan.balanced ? "équilibré" : "écart"}</p></section>
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4"><h2 className="font-semibold">CPC</h2><p>Produits <MoneyDisplay value={liasse.cpc.produits} /> · Charges <MoneyDisplay value={liasse.cpc.charges} /> · Résultat <MoneyDisplay value={liasse.cpc.resultat} /></p></section>
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4"><h2 className="font-semibold">ESG</h2><p>Capitaux de clôture <MoneyDisplay value={liasse.esg.capitauxFin} /></p></section>
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4"><h2 className="font-semibold">Financement</h2><p>Variation <MoneyDisplay value={liasse.financement.variation} /></p></section>
      </div>
      <p className="mt-4 text-sm"><Link className="font-semibold text-[var(--primary)]" href="/comptabilite/fec">Export de type FEC</Link> · <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/edi-simpl">EDI SIMPL préparatoire</Link></p>
    </ModulePage>
  );
}
