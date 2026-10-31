import Link from "next/link";
import { BookOpen, Boxes, FileText, Mail, Users } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

const modules = [
  { title: "Stock et logistique", description: "Emplacements, mouvements, réceptions et livraisons.", icon: Boxes },
  { title: "Comptabilité avancée", description: "Plan comptable, grand livre, balance et outils TVA.", icon: BookOpen },
  { title: "Gestion commerciale", description: "Devis, commandes, relances et gestion documentaire.", icon: FileText },
  { title: "Ressources humaines", description: "Personnel, congés, paie et documents RH.", icon: Users },
];

export default async function ModulesOnRequestPage() {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const subject = `Demande de module — ${workspace.organization.name}`;
  const body = `Bonjour,\n\nJe souhaite activer un module complémentaire pour mon entreprise.\n\nEntreprise : ${workspace.organization.name}\nIdentifiant entreprise : ${workspace.organization.id}\nModule souhaité : \nBesoin : \n\nMerci.`;
  const email = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
  const contactHref = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Modules sur demande" description="Un espace simple au quotidien, des possibilités supplémentaires quand vous en avez besoin." />
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Votre essentiel est déjà là</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Créez vos factures de vente et d’achat, enregistrez leurs règlements,
          suivez votre trésorerie et gérez vos journaux comptables.
          Les modules complémentaires s’activent avec l’équipe Felexia selon vos besoins.
        </p>
        {fullAccess ? <p className="mt-3 text-sm text-[var(--primary)]">L’interface complète est activée pour votre entreprise, selon les droits de votre abonnement.</p> : null}
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
        <Button asChild><a href={contactHref}><Mail className="h-4 w-4" /> Demander un module</a></Button>
        <Button asChild variant="secondary"><Link href="/dashboard">Retour à l’accueil</Link></Button>
      </div>
      <p className="text-xs text-[var(--muted)]">Le bouton ouvre votre messagerie avec une demande préremplie à {email}.</p>
    </div>
  );
}
