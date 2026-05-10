"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ClipboardList,
  CreditCard,
  FileClock,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  Truck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "danger" | "warning" | "info";
};

type SidebarSection = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  items?: SidebarItem[];
};

const quickActions: SidebarItem[] = [
  { label: "Nouveau devis", href: "/vente/devis/new", icon: Plus },
  { label: "Nouvelle facture", href: "/facturation/factures/new", icon: Plus },
  { label: "Paiement recu", href: "/facturation/paiements/new", icon: Plus },
];

const sections: SidebarSection[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    key: "ventes",
    label: "Ventes",
    href: "/vente",
    icon: BadgeDollarSign,
    items: [
      { label: "Devis", href: "/vente/devis", icon: FileText },
      { label: "Commandes", href: "/vente/commandes", icon: ClipboardList },
      { label: "Bons de livraison", href: "/vente/livraisons", icon: Truck },
      { label: "Retours client", href: "/vente/retours", icon: RotateCcw },
    ],
  },
  {
    key: "facturation",
    label: "Facturation & Paiements",
    href: "/facturation",
    icon: Receipt,
    items: [
      { label: "Factures", href: "/facturation/factures", icon: FileText },
      { label: "Avoirs", href: "/facturation/avoirs", icon: RotateCcw },
      { label: "Paiements recus", href: "/facturation/paiements", icon: WalletCards },
      { label: "Impayes", href: "/facturation/factures?paymentStatus=unpaid", icon: ShieldAlert, badge: "12", badgeTone: "danger" },
      { label: "Relances", href: "/facturation/relances", icon: BellRing },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    items: [
      { label: "Vue globale", href: "/stock", icon: Gauge },
      { label: "Produits", href: "/articles/produits", icon: Package },
      { label: "Mouvements", href: "/stock/mouvements", icon: ArrowLeftRight },
      { label: "Ajustements", href: "/stock/ajustements/new", icon: Calculator },
      { label: "Alertes stock", href: "/stock", icon: ShieldAlert, badge: "3", badgeTone: "warning" },
    ],
  },
  {
    key: "tresorerie",
    label: "Tresorerie",
    href: "/tresorerie",
    icon: Landmark,
    items: [
      { label: "Comptes bancaires", href: "/banques", icon: Landmark },
      { label: "Caisses", href: "/caisses", icon: Banknote },
      { label: "Depenses", href: "/decaissements", icon: CreditCard },
      { label: "Encaissements", href: "/encaissements", icon: WalletCards },
      { label: "Virements", href: "/tresorerie/virements", icon: ArrowLeftRight },
      { label: "Rapprochements", href: "/tresorerie/rapprochements", icon: BarChart3 },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    href: "/tiers",
    icon: Users,
    items: [
      { label: "Clients", href: "/tiers/clients", icon: Building2 },
      { label: "Prospects", href: "/tiers/prospects", icon: Target },
      { label: "Activites", href: "/agenda", icon: BellRing },
      { label: "Taches", href: "/agenda/taches", icon: ClipboardList },
    ],
  },
  {
    key: "comptabilite",
    label: "Comptabilite",
    href: "/comptabilite",
    icon: BookOpen,
    items: [
      { label: "Ecritures", href: "/comptabilite/ecritures", icon: FileText },
      { label: "Journal", href: "/comptabilite/journaux", icon: BookOpen },
      { label: "Grand livre", href: "/comptabilite/grand-livre", icon: BookOpen },
      { label: "Balance", href: "/comptabilite/balance", icon: BarChart3 },
      { label: "TVA", href: "/comptabilite/tva", icon: Calculator },
      { label: "Resultat", href: "/comptabilite/resultat", icon: BarChart3 },
    ],
  },
  { key: "settings", label: "Parametres", href: "/parametres", icon: Settings },
];

function pathMatches(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

function Badge({ value, tone = "info" }: { value: string; tone?: "danger" | "warning" | "info" }) {
  const styles = {
    danger: "bg-rose-500 text-white",
    warning: "bg-amber-400 text-slate-950",
    info: "bg-blue-500 text-white",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", styles[tone])}>{value}</span>;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const initiallyOpen = useMemo(() => sections.filter((section) => section.items?.some((item) => pathMatches(pathname, item.href)) || pathMatches(pathname, section.href)).map((section) => section.key), [pathname]);
  const [open, setOpen] = useState<string[]>(initiallyOpen);

  function toggle(key: string) {
    setOpen((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl transition-transform duration-300 lg:translate-x-0",
        collapsed ? "lg:w-24" : "lg:w-[280px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3" onClick={onCloseMobile}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25">
            <Sparkles className="h-5 w-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-tight">Felexia</span>
              <span className="block truncate text-xs text-slate-400">Gestion PME</span>
            </span>
          ) : null}
        </Link>
        <button type="button" className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" onClick={onCloseMobile} aria-label="Fermer le menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      {!collapsed ? (
        <div className="space-y-4 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400">
            <Search className="h-4 w-4" />
            <span className="flex-1">Rechercher...</span>
            <span className="rounded-lg border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</span>
          </div>
          <div className="grid gap-2">
            {quickActions.map((item) => {
              const Icon = item.icon ?? Plus;
              return (
                <Link key={item.href} href={item.href} onClick={onCloseMobile} className="flex items-center gap-2 rounded-xl bg-blue-600/15 px-3 py-2 text-sm font-medium text-blue-100 ring-1 ring-blue-400/20 transition hover:bg-blue-600/25">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = pathMatches(pathname, section.href) || Boolean(section.items?.some((item) => pathMatches(pathname, item.href)));
          const expanded = !collapsed && (open.includes(section.key) || active);
          return (
            <div key={section.key}>
              <div className="flex items-center gap-1">
                <Link
                  href={section.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "group relative flex min-h-11 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                  title={collapsed ? section.label : undefined}
                >
                  <span className={cn("absolute left-0 top-2 h-7 w-1 rounded-r-full bg-blue-400 transition-opacity", active ? "opacity-100" : "opacity-0")} />
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="min-w-0 flex-1 truncate">{section.label}</span> : null}
                </Link>
                {!collapsed && section.items ? (
                  <button type="button" onClick={() => toggle(section.key)} className="flex h-10 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-white" aria-label={`Ouvrir ${section.label}`}>
                    <ChevronDown className={cn("h-4 w-4 transition", expanded ? "rotate-180" : "")} />
                  </button>
                ) : null}
              </div>
              {expanded && section.items ? (
                <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = pathMatches(pathname, item.href);
                    return (
                      <Link key={`${section.key}-${item.label}`} href={item.href} onClick={onCloseMobile} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition", itemActive ? "bg-blue-600/20 text-blue-100" : "text-slate-500 hover:bg-white/5 hover:text-white")}>
                        {ItemIcon ? <ItemIcon className="h-3.5 w-3.5" /> : null}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge ? <Badge value={item.badge} tone={item.badgeTone} /> : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button type="button" onClick={onToggleCollapsed} className="hidden w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white lg:flex">
          <ChevronsLeft className={cn("h-4 w-4 transition", collapsed ? "rotate-180" : "")} />
          {!collapsed ? "Reduire le menu" : null}
        </button>
      </div>
    </aside>
  );
}
