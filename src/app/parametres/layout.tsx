import type { ReactNode } from "react";
import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

const navItems = [
  { label: "Mon profil", href: "/parametres/profil", key: "profil" },
  { label: "Entreprise", href: "/parametres/entreprise", key: "entreprise" },
  { label: "Utilisateurs", href: "/parametres/utilisateurs", key: "utilisateurs" },
  { label: "Rôles & habilitations", href: "/parametres/roles", key: "roles" },
  { label: "Abonnement", href: "/parametres/abonnement", key: "abonnement" },
  { label: "Modules", href: "/parametres/modules", key: "modules" },
  { label: "Facturation", href: "/parametres/facturation", key: "facturation" },
  { label: "Documents", href: "/parametres/documents", key: "documents" },
  { label: "Sécurité", href: "/parametres/securite", key: "securite" },
  { label: "Préférences", href: "/parametres/preferences", key: "preferences" },
  { label: "Numérotation", href: "/parametres/numerotation", key: "numerotation" },
];

const lightNavItems = [
  { label: "Mon entreprise", href: "/parametres/entreprise", key: "entreprise" },
  { label: "Mon équipe", href: "/parametres/utilisateurs", key: "utilisateurs" },
  { label: "Mon abonnement", href: "/parametres/abonnement", key: "abonnement" },
  { label: "Modèles de factures", href: "/parametres/documents", key: "documents" },
  { label: "Numérotation", href: "/parametres/numerotation", key: "numerotation" },
  { label: "Catalogue articles & services", href: "/articles", key: "articles" },
  { label: "Modules sur demande", href: "/parametres/modules", key: "modules" },
];

export default async function ParametresLayout({ children }: { children: ReactNode }) {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  return (
    <ModulePage>
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav aria-label="Paramètres de l'entreprise" className="sticky top-8 space-y-1">
            {(fullAccess ? navItems : lightNavItems).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ModulePage>
  );
}
