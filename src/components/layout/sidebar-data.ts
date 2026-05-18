import type { ComponentType } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  BadgeDollarSign,
  Receipt,
  Boxes,
  Landmark,
  Users,
  BookOpen,
  Settings,
  Gauge,
  ClipboardList,
  Truck,
  WalletCards,
  FileText,
  BellRing,
  ShieldAlert,
  Package,
  Building2,
  ArrowLeftRight,
  Calculator,
  Search,
  BarChart3,
  Plus,
  RotateCcw,
  Target,
  Sparkles,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "danger" | "warning" | "info";
};

export type SidebarSection = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  items?: SidebarItem[];
  moduleKey?: string; // if set, section is hidden when module is disabled
};

export const quickActions: SidebarItem[] = [
  { label: "Nouveau devis", href: "/vente/devis/new", icon: Plus },
  { label: "Nouvelle commande", href: "/achats/commandes/new", icon: Plus },
  { label: "Nouvelle facture", href: "/facturation/factures/new", icon: Plus },
  { label: "Paiement reçu", href: "/facturation/paiements/new", icon: Plus },
];

export const sections: SidebarSection[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "welcome", label: "Guide de démarrage", href: "/bienvenue", icon: Sparkles },
  {
    key: "achats",
    label: "Achats",
    href: "/achats",
    icon: ShoppingCart,
    moduleKey: "purchases",
    items: [
      { label: "Tableau achats", href: "/achats", icon: Gauge },
      { label: "Fournisseurs", href: "/achats/fournisseurs", icon: Users },
      { label: "Commandes", href: "/achats/commandes", icon: ClipboardList },
      { label: "Réceptions", href: "/achats/receptions", icon: Truck },
      { label: "Factures", href: "/achats/factures", icon: Receipt },
      { label: "Paiements", href: "/achats/paiements", icon: WalletCards },
    ],
  },
  {
    key: "ventes",
    label: "Ventes",
    href: "/vente",
    icon: BadgeDollarSign,
    moduleKey: "quotes",
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
    moduleKey: "invoicing",
    items: [
      { label: "Factures", href: "/facturation/factures", icon: FileText },
      { label: "Avoirs", href: "/facturation/avoirs", icon: RotateCcw },
      { label: "Paiements reçus", href: "/facturation/paiements", icon: WalletCards },
      { label: "Impayés", href: "/facturation/factures?paymentStatus=unpaid", icon: ShieldAlert, badge: "12", badgeTone: "danger" },
      { label: "Relances", href: "/facturation/relances", icon: BellRing },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    moduleKey: "stock",
    items: [
      { label: "Vue globale", href: "/stock", icon: Gauge },
      { label: "Emplacements", href: "/stock/emplacements", icon: Building2 },
      { label: "Produits", href: "/articles/produits", icon: Package },
      { label: "Mouvements", href: "/stock/mouvements", icon: ArrowLeftRight },
      { label: "Ajustements", href: "/stock/ajustements/new", icon: Calculator },
      { label: "Alertes stock", href: "/stock", icon: ShieldAlert, badge: "3", badgeTone: "warning" },
    ],
  },
  {
    key: "tresorerie",
    label: "Trésorerie",
    href: "/tresorerie",
    icon: Landmark,
    moduleKey: "treasury",
    items: [
      { label: "Tableau trésorerie", href: "/tresorerie", icon: Gauge },
      { label: "Consultation", href: "/tresorerie/consultation", icon: Search },
      { label: "Comptes & caisses", href: "/tresorerie/comptes", icon: Landmark },
      { label: "Mouvements", href: "/tresorerie/mouvements", icon: ArrowLeftRight },
      { label: "Relevés bancaires", href: "/tresorerie/releves", icon: FileText },
      { label: "Rapprochement", href: "/tresorerie/rapprochement", icon: BarChart3 },
      { label: "Prévisions", href: "/tresorerie/previsions", icon: Sparkles },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    href: "/tiers",
    icon: Users,
    moduleKey: "crm",
    items: [
      { label: "Clients", href: "/tiers/clients", icon: Building2 },
      { label: "Prospects", href: "/tiers/prospects", icon: Target },
      { label: "Activités", href: "/agenda", icon: BellRing },
      { label: "Tâches", href: "/agenda/taches", icon: ClipboardList },
    ],
  },
  {
    key: "comptabilite",
    label: "Comptabilité",
    href: "/comptabilite",
    icon: BookOpen,
    moduleKey: "accounting",
    items: [
      { label: "Écritures", href: "/comptabilite/ecritures", icon: FileText },
      { label: "Journaux", href: "/comptabilite/journaux", icon: BookOpen },
      { label: "Plan comptable", href: "/comptabilite/plan-comptable", icon: ClipboardList },
      { label: "Grand livre", href: "/comptabilite/grand-livre", icon: BookOpen },
      { label: "Balance", href: "/comptabilite/balance", icon: BarChart3 },
      { label: "TVA", href: "/comptabilite/tva", icon: Calculator },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    moduleKey: "documents",
    items: [
      { label: "Tous les documents", href: "/documents", icon: FileText },
      { label: "Import / Export", href: "/documents/import-export", icon: ArrowLeftRight },
    ],
  },
  { key: "settings", label: "Paramètres", href: "/parametres", icon: Settings },
];
