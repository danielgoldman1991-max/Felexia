import Link from "next/link";
import { ArrowRight, BookOpen, Boxes, FileText, Users } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

const modules = [
  { title: "Stock et logistique", description: "Emplacements, mouvements, réceptions et livraisons.", icon: Boxes },
  { title: "Comptabilité avancée", description: "Plan comptable, grand livre, balance et outils TVA.", icon: BookOpen },
  { title: "Gestion commerciale", description: "Devis, commandes, relances et gestion documentaire.", icon: FileText },
  { title: "Ressources humaines", description: "Personnel, congés, paie et documents RH.", icon: Users },
];

export default async function ProModulesPage() {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="La gestion complète avec PRO" description="Deux offres pour accompagner votre entreprise : ESSENTIEL au quotidien, PRO pour aller plus loin." />
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Tout ESSENTIEL, avec les modules de l’ERP complet</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Créez vos factures de vente et d’achat, enregistrez leurs règlements,
          suivez votre trésorerie et gérez vos journaux comptables.
          Avec PRO, reliez aussi vos devis, commandes, livraisons, stocks,
          outils comptables, TVA et ressources humaines.
        </p>
        {fullAccess ? <p className="mt-3 text-sm text-[var(--primary)]">Votre entreprise dispose déjà de l’interface complète. Les actions disponibles dépendent de votre rôle et de la validité de votre abonnement.</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map(({ title, description, icon: Icon }) => (
          <div key={title} className="rounded-2xl border border-[var(--border)] p-5">
            <Icon className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild><Link href="/parametres/abonnement?plan=pro">{fullAccess ? "Gérer mon abonnement" : "Découvrir l’offre PRO"}<ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild variant="secondary"><Link href="/dashboard">Retour à l’accueil</Link></Button>
      </div>
      <p className="text-xs text-[var(--muted)]">Les outils TVA et paie préparent vos données et documents ; leur validation reste à votre charge.</p>
    </div>
  );
}
