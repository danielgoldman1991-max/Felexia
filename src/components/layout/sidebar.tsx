"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Boxes,
  CalendarDays,
  Calculator,
  ChevronDown,
  Files,
  Folder,
  Home,
  Landmark,
  PackageOpen,
  Receipt,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  href: string;
};

type MenuSection = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  activePrefixes: string[];
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    key: "accueil",
    label: "Accueil",
    href: "/dashboard",
    icon: Home,
    activePrefixes: ["/dashboard"],
    items: [],
  },
  {
    key: "tiers",
    label: "Tiers",
    href: "/tiers",
    icon: Building2,
    activePrefixes: ["/tiers"],
    items: [
      { label: "Tous les tiers", href: "/tiers" },
      { label: "Prospects", href: "/tiers/prospects" },
      { label: "Clients", href: "/tiers/clients" },
      { label: "Fournisseurs", href: "/tiers/fournisseurs" },
    ],
  },
  {
    key: "produits-services",
    label: "Produits | Services",
    href: "/articles",
    icon: PackageOpen,
    activePrefixes: ["/articles"],
    items: [
      { label: "Tous les articles", href: "/articles" },
      { label: "Produits", href: "/articles/produits" },
      { label: "Services", href: "/articles/services" },
      { label: "Nouvel article/service", href: "/articles/new" },
      { label: "Categories", href: "/articles/categories" },
      { label: "Unites", href: "/articles/unites" },
      { label: "TVA", href: "/articles/tva" },
    ],
  },
  {
    key: "vente",
    label: "Vente",
    href: "/vente",
    icon: BriefcaseBusiness,
    activePrefixes: ["/vente"],
    items: [
      { label: "Tableau des ventes", href: "/vente" },
      { label: "Devis", href: "/vente/devis" },
      { label: "Nouveau devis", href: "/vente/devis/new" },
      { label: "Commandes clients", href: "/vente/commandes" },
      { label: "Nouvelle commande", href: "/vente/commandes/new" },
      { label: "Bons de livraison", href: "/vente/livraisons" },
      { label: "Nouveau bon de livraison", href: "/vente/livraisons/new" },
      { label: "Retours client", href: "/vente/retours" },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    activePrefixes: ["/stock"],
    items: [
      { label: "Vue stock", href: "/stock" },
      { label: "Mouvements par article", href: "/stock/mouvements" },
      { label: "Entree manuelle", href: "/stock/entrees/new" },
      { label: "Ajustement stock", href: "/stock/ajustements/new" },
    ],
  },
  {
    key: "facturation-paiement",
    label: "Facturation | Paiement",
    href: "/factures",
    icon: Receipt,
    activePrefixes: ["/factures", "/paiements", "/relances", "/avoirs"],
    items: [
      { label: "Factures clients", href: "/factures" },
      { label: "Nouvelle facture", href: "/factures/new" },
      { label: "Paiements clients", href: "/paiements" },
      { label: "Relances clients", href: "/relances" },
      { label: "Avoirs", href: "/avoirs" },
    ],
  },
  {
    key: "banques-caisses",
    label: "Banques | Caisses",
    href: "/tresorerie",
    icon: Wallet,
    activePrefixes: ["/tresorerie", "/banques", "/caisses", "/encaissements", "/decaissements"],
    items: [
      { label: "Tresorerie", href: "/tresorerie" },
      { label: "Banques", href: "/banques" },
      { label: "Caisses", href: "/caisses" },
      { label: "Encaissements", href: "/encaissements" },
      { label: "Decaissements", href: "/decaissements" },
      { label: "Previsions", href: "/tresorerie/previsions" },
    ],
  },
  {
    key: "comptabilite",
    label: "Comptabilite",
    href: "/comptabilite",
    icon: Calculator,
    activePrefixes: ["/comptabilite"],
    items: [
      { label: "Tableau comptable", href: "/comptabilite" },
      { label: "Journaux", href: "/comptabilite/journaux" },
      { label: "Plan comptable", href: "/comptabilite/plan-comptable" },
      { label: "Ecritures", href: "/comptabilite/ecritures" },
      { label: "TVA", href: "/comptabilite/tva" },
      { label: "Exports comptables", href: "/comptabilite/exports" },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    href: "/documents",
    icon: Folder,
    activePrefixes: ["/documents"],
    items: [
      { label: "Tous les documents", href: "/documents" },
      { label: "Modeles PDF", href: "/documents/modeles" },
      { label: "Pieces jointes", href: "/documents/pieces-jointes" },
      { label: "Archives", href: "/documents/archives" },
    ],
  },
  {
    key: "agenda",
    label: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
    activePrefixes: ["/agenda"],
    items: [
      { label: "Agenda", href: "/agenda" },
      { label: "Taches", href: "/agenda/taches" },
      { label: "Rappels", href: "/agenda/rappels" },
      { label: "Relances a faire", href: "/agenda/relances" },
      { label: "Echeances", href: "/agenda/echeances" },
    ],
  },
  {
    key: "outils",
    label: "Outils",
    href: "/outils",
    icon: Wrench,
    activePrefixes: ["/outils", "/parametres"],
    items: [
      { label: "Parametres", href: "/parametres" },
      { label: "Utilisateurs", href: "/parametres/utilisateurs" },
      { label: "Roles & permissions", href: "/parametres/roles" },
      { label: "Numerotation", href: "/parametres/numerotation" },
      { label: "Import / Export", href: "/outils/import-export" },
      { label: "Audit log", href: "/outils/audit-log" },
    ],
  },
];

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionIsActive(pathname: string, section: MenuSection) {
  return section.activePrefixes.some((prefix) => pathMatches(pathname, prefix));
}

export function Sidebar() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (key: string) => {
    setOpenSections((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const parentClass = (active: boolean) =>
    cn(
      "group flex min-h-10 flex-1 items-center gap-3 rounded-[var(--radius-md)] border-l-4 px-3 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42D6D6]/70",
      active
        ? "border-[#42D6D6] bg-[#243B78] text-white shadow-sm"
        : "border-transparent text-white/80 hover:bg-white/10 hover:text-white",
    );

  const subLinkClass = (href: string) =>
    cn(
      "block rounded-[var(--radius-sm)] border-l-2 px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42D6D6]/70",
      pathname === href
        ? "border-[#42D6D6] bg-[#243B78] text-white shadow-sm"
        : "border-transparent text-white/65 hover:bg-white/10 hover:text-white",
    );

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-white/10 bg-[linear-gradient(180deg,var(--secondary-deep)_0%,#20186f_58%,#16124a_100%)] text-white shadow-[18px_0_40px_rgb(22_18_74_/_10%)] lg:flex lg:flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-white/7 p-3 ring-1 ring-white/10 transition hover:bg-white/10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-white shadow-[var(--shadow-sm)]">
            <Image
              src="/felexia-conseils-logo.jpg"
              alt="Logo Felexia Conseils"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5 text-white">
              Felexia facilite
            </span>
            <span className="block text-sm font-semibold leading-5 text-white">
              ta gestion
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {menuSections.map((section) => {
          const Icon = section.icon;
          const active = sectionIsActive(pathname, section);
          const open = active || openSections.includes(section.key);
          const hasChildren = section.items.length > 0;

          return (
            <div key={section.key} className="space-y-1">
              <div className="flex items-center gap-1">
                <Link href={section.href} className={parentClass(active)}>
                  <Icon className="h-4 w-4 shrink-0 text-current opacity-90 transition group-hover:opacity-100" />
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                </Link>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className={cn(
                      "flex h-10 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42D6D6]/70",
                      open ? "text-white" : "",
                    )}
                    aria-label={open ? `Fermer ${section.label}` : `Ouvrir ${section.label}`}
                    aria-expanded={open}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
                  </button>
                ) : null}
              </div>

              {hasChildren && open ? (
                <div className="ml-7 space-y-1 border-l border-white/10 pl-3">
                  {section.items.map((item) => (
                    <Link key={item.href} href={item.href} className={subLinkClass(item.href)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/45">
        <div className="flex items-center gap-2">
          <Landmark className="h-3.5 w-3.5" />
          Gestion PME
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Files className="h-3.5 w-3.5" />
          Modules progressifs
        </div>
      </div>
    </aside>
  );
}
