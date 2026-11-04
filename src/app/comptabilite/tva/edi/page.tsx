import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

export default function EdiPeriodPage() {
  const now = new Date();
  return (
    <ModulePage>
      <PageHeader title="EDI SIMPL" description="Choisissez le mois à déclarer. Le fichier est préparatoire et contient l'ICE et l'identifiant fiscal lorsqu'ils sont renseignés." />
      <form className="flex flex-wrap items-end gap-3" action="/comptabilite/tva/edi-simpl">
        <label className="text-sm">Mois<input name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} className="mt-1 block h-11 w-24 rounded border border-[var(--border)] px-2" /></label>
        <label className="text-sm">Année<input name="year" type="number" defaultValue={now.getFullYear()} className="mt-1 block h-11 w-28 rounded border border-[var(--border)] px-2" /></label>
        <Button type="submit">Télécharger</Button>
      </form>
      <p className="mt-4 text-sm"><a className="font-semibold text-[var(--primary)]" href="/comptabilite/tva/declarations">Les déclarations affichent aussi la colonne 10 %.</a></p>
    </ModulePage>
  );
}
