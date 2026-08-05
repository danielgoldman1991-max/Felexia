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
  RotateCcw,
  Target,
  Sparkles,
  UsersRound,
  BriefcaseBusiness,
  CalendarDays,
  FileBadge,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "danger" | "warning" | "info";
  hidden?: boolean; // if set, item is defined but not rendered in the sidebar
};

export type SidebarSection = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  items?: SidebarItem[];
  moduleKey?: string; // if set, section is hidden when module is disabled
  hidden?: boolean; // if set, section is defined but not rendered in the sidebar
};

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
      { label: "Clients", href: "/tiers/clients", icon: Users },
      { label: "Prospects", href: "/tiers/prospects", icon: Target },
      { label: "Devis", href: "/vente/devis", icon: FileText },
      { label: "Commandes", href: "/vente/commandes", icon: ClipboardList },
      { label: "Bons de livraison", href: "/vente/livraisons", icon: Truck },
      { label: "Retours client", href: "/vente/retours", icon: RotateCcw },
    ],
  },
  {
    key: "articles",
    label: "Articles",
    href: "/articles/produits",
    icon: Package,
    moduleKey: "products",
    items: [
      { label: "Produits", href: "/articles/produits", icon: Package },
      { label: "Services", href: "/articles/services", icon: ClipboardList },
      { label: "Catégories", href: "/articles/categories", icon: BookOpen },
      { label: "Unités", href: "/articles/unites", icon: Calculator },
      { label: "Taux TVA", href: "/articles/tva", icon: FileText },
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
      { label: "Relevés bancaires", href: "/tresorerie/releves", icon: FileText, hidden: true },
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
    hidden: true,
    items: [
      { label: "Clients", href: "/tiers/clients", icon: Building2 },
      { label: "Prospects", href: "/tiers/prospects", icon: Target },
      { label: "Activités", href: "/agenda", icon: BellRing },
      { label: "Tâches", href: "/agenda/taches", icon: ClipboardList },
    ],
  },
  {
    key: "rh",
    label: "Ressources humaines",
    href: "/rh/dashboard",
    icon: UsersRound,
    moduleKey: "rh",
    items: [
      { label: "Tableau RH", href: "/rh/dashboard", icon: Gauge },
      { label: "Employés", href: "/rh/employes", icon: UsersRound },
      { label: "Contrats", href: "/rh/contrats", icon: BriefcaseBusiness },
      { label: "Présences", href: "/rh/presences", icon: CalendarDays },
      { label: "Absences", href: "/rh/absences", icon: ShieldAlert },
      { label: "Congés", href: "/rh/conges", icon: Sparkles },
      { label: "Paie", href: "/rh/paie", icon: Calculator },
      { label: "Bulletins", href: "/rh/paie/bulletins", icon: FileBadge },
      { label: "Avances", href: "/rh/avances", icon: WalletCards },
      { label: "Prêts", href: "/rh/prets", icon: Landmark },
      { label: "Notes de frais", href: "/rh/notes-de-frais", icon: Receipt },
      { label: "Documents RH", href: "/rh/documents", icon: FileText },
      { label: "Attestations", href: "/rh/attestations", icon: FileBadge },
      { label: "CNSS / AMO", href: "/rh/cnss", icon: ShieldAlert },
      { label: "IR salaire", href: "/rh/ir", icon: Calculator },
      { label: "Évaluations", href: "/rh/evaluations", icon: BarChart3 },
      { label: "Discipline", href: "/rh/discipline", icon: ShieldAlert },
      { label: "Onboarding", href: "/rh/onboarding", icon: Sparkles },
      { label: "Offboarding", href: "/rh/offboarding", icon: RotateCcw },
      { label: "Paramètres RH", href: "/rh/parametres", icon: Settings },
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
