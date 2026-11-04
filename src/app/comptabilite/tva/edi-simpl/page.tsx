import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function selectedPeriod(params: { periode?: string; year?: string; month?: string }) {
  const match = /^(\d{4})-(\d{2})$/.exec(params.periode ?? "");
  const now = new Date();
  const year = Number(match?.[1] ?? params.year ?? now.getFullYear());
  const month = Number(match?.[2] ?? params.month ?? now.getMonth() + 1);
  const safeYear = Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : now.getFullYear();
  const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  return { year: safeYear, month: safeMonth, periode: `${safeYear}-${String(safeMonth).padStart(2, "0")}` };
}

export default async function EdiSimplPage({ searchParams }: { searchParams: Promise<{ periode?: string; year?: string; month?: string }> }) {
  const period = selectedPeriod(await searchParams);
  const download = `/comptabilite/tva/edi-simpl/fichier?periode=${period.periode}`;
  return (
    <ModulePage>
      <PageHeader title="EDI SIMPL" description="Choisissez le mois à déclarer. Le fichier préparatoire contient toujours la ligne 10 % (092), même à zéro." />
      <form className="flex flex-wrap items-end gap-3" action="/comptabilite/tva/edi-simpl" method="get">
        <label className="text-sm">Mois
          <input name="month" type="number" min="1" max="12" defaultValue={period.month} className="mt-1 block h-11 w-24 rounded border border-[var(--border)] px-2" />
        </label>
        <label className="text-sm">Année
          <input name="year" type="number" defaultValue={period.year} className="mt-1 block h-11 w-28 rounded border border-[var(--border)] px-2" />
        </label>
        <Button type="submit" variant="secondary">Afficher la période</Button>
      </form>
      <p className="mt-4 text-sm">Période sélectionnée : <strong>{period.periode}</strong>.</p>
      <p className="mt-3"><Link className="inline-flex h-11 items-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-semibold text-white" href={download}>Télécharger {period.periode}</Link></p>
      <p className="mt-4 text-sm"><Link className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/declarations">Les déclarations affichent aussi la colonne 10 %.</Link></p>
    </ModulePage>
  );
}
