import { ESSENTIEL_MODULE_KEYS, BUSINESS_MODULE_KEYS, PREMIUM_MODULE_KEYS, getModulesForPlan } from "@/lib/subscriptions/plan-modules";
import { DEFAULT_PLAN_KEY, PLAN_KEYS, type PlanKey } from "@/lib/subscriptions/plans-config";

export type PlanCode = PlanKey;

export type PlanFeatureKey =
  | "dashboard"
  | "clients"
  | "products"
  | "quotes"
  | "orders"
  | "invoices"
  | "payments"
  | "documents"
  | "import_export"
  | "company_settings"
  | "users_basic"
  | "leads"
  | "pipeline"
  | "advanced_orders"
  | "delivery_notes"
  | "credit_notes"
  | "customer_reminders"
  | "suppliers"
  | "purchases"
  | "receipt_notes"
  | "supplier_invoices"
  | "stock"
  | "documents_advanced"
  | "export_csv_excel"
  | "accounting_basic"
  | "vat"
  | "journals"
  | "roles_permissions"
  | "audit_log"
  | "advanced_permissions"
  | "document_management_advanced"
  | "exports_advanced"
  | "accounting_advanced"
  | "custom_chart_of_accounts"
  | "auto_accounting_entries"
  | "vat_advanced"
  | "dashboards_advanced"
  | "reports_basic"
  | "reports_advanced"
  | "sales_reporting"
  | "financial_reporting"
  | "customer_reporting"
  | "supplier_reporting"
  | "margin_tracking"
  | "full_history"
  | "priority_support"
  | "onboarding_support"
  | "light_customization";

export type PlanLimits = {
  organizations: number;
  users: number;
  commercialDocumentsPerMonth: number | null;
  storageMb: number;
};

export type SubscriptionPlanDefinition = {
  code: PlanCode;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: "MAD";
  isRecommended: boolean;
  limits: PlanLimits;
  features: PlanFeatureKey[];
  featureHighlights: string[];
  limitHighlights: string[];
  moduleKeys: string[];
  sortOrder: number;
};

const ESSENTIEL_FEATURES: PlanFeatureKey[] = [
  "dashboard",
  "clients",
  "leads",
  "pipeline",
  "products",
  "quotes",
  "orders",
  "delivery_notes",
  "credit_notes",
  "invoices",
  "payments",
  "customer_reminders",
  "suppliers",
  "purchases",
  "receipt_notes",
  "supplier_invoices",
  "stock",
  "accounting_basic",
  "journals",
  "documents",
  "import_export",
  "company_settings",
  "users_basic",
];

const BUSINESS_FEATURES: PlanFeatureKey[] = [
  ...ESSENTIEL_FEATURES,
  "advanced_orders",
  "documents_advanced",
  "export_csv_excel",
  "accounting_basic",
  "vat",
  "journals",
  "roles_permissions",
  "audit_log",
];

const PREMIUM_FEATURES: PlanFeatureKey[] = [
  ...BUSINESS_FEATURES,
  "advanced_permissions",
  "document_management_advanced",
  "exports_advanced",
  "accounting_advanced",
  "custom_chart_of_accounts",
  "auto_accounting_entries",
  "vat_advanced",
  "dashboards_advanced",
  "reports_basic",
  "reports_advanced",
  "sales_reporting",
  "financial_reporting",
  "customer_reporting",
  "supplier_reporting",
  "margin_tracking",
  "full_history",
  "priority_support",
  "onboarding_support",
  "light_customization",
];

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    code: "essentiel",
    name: "Essentiel",
    description: "Pour démarrer simplement : factures de vente et d’achat, règlements, trésorerie et journaux.",
    monthlyPrice: 99,
    yearlyPrice: 1188,
    currency: "MAD",
    isRecommended: false,
    limits: {
      organizations: 1,
      users: 3,
      commercialDocumentsPerMonth: 500,
      storageMb: 1024,
    },
    features: ESSENTIEL_FEATURES,
    featureHighlights: [
      "Votre espace entreprise",
      "Clients et fournisseurs",
      "Factures de vente et d’achat",
      "Règlements clients et fournisseurs",
      "Trésorerie : comptes, caisses et mouvements",
      "Journaux et écritures comptables",
      "Factures PDF personnalisées",
      "Paramètres et utilisateurs",
      "Évoluez vers PRO pour l’ERP complet",
    ],
    limitHighlights: [
      "1 organisation",
      "3 utilisateurs maximum",
      "500 documents commerciaux / mois",
      "Stockage limite",
      "Interface simplifiée",
    ],
    moduleKeys: [...ESSENTIEL_MODULE_KEYS],
    sortOrder: 1,
  },
  {
    code: "business",
    name: "Business",
    description: "Le pack recommande pour piloter ventes, achats, stock, TVA et comptabilite complete.",
    monthlyPrice: 690,
    yearlyPrice: 6900,
    currency: "MAD",
    isRecommended: true,
    limits: {
      organizations: 1,
      users: 10,
      commercialDocumentsPerMonth: 3000,
      storageMb: 5120,
    },
    features: BUSINESS_FEATURES,
    featureHighlights: [
      "Tout Essentiel",
      "Documents avances",
      "Export CSV / Excel",
      "Preparation comptable et TVA",
      "Roles, permissions et historique",
      "Reporting et analyses",
      "Support standard",
    ],
    limitHighlights: [
      "10 utilisateurs maximum",
      "3000 documents commerciaux / mois",
      "Stockage moyen",
      "Support standard",
    ],
    moduleKeys: [...BUSINESS_MODULE_KEYS],
    sortOrder: 2,
  },
  {
    code: "premium",
    name: "PRO",
    description: "L’ERP complet pour relier ventes, achats, stock, comptabilité, TVA et ressources humaines.",
    // Historical contract amounts only; public PRO pricing is quote-only.
    // Renderers must use isPlanQuoteOnly() before displaying prices or savings.
    monthlyPrice: 1290,
    yearlyPrice: 12900,
    currency: "MAD",
    isRecommended: true,
    limits: {
      organizations: 1,
      users: 25,
      commercialDocumentsPerMonth: null,
      storageMb: 20480,
    },
    features: PREMIUM_FEATURES,
    featureHighlights: [
      "Tout Essentiel, avec l’interface complète",
      "Prospects, devis, commandes et livraisons",
      "Commandes fournisseurs et réceptions",
      "Stock, emplacements et mouvements",
      "Plan comptable, grand livre et balance",
      "Préparation et suivi des déclarations TVA",
      "Personnel, congés et paie préparatoire",
      "Gestion documentaire",
      "Exports CSV et journaux Excel",
      "Tableaux de bord de gestion",
    ],
    limitHighlights: [
      "25 utilisateurs maximum",
      "Documents commerciaux sans limite mensuelle",
      "20 Go de stockage",
      "ERP complet",
    ],
    moduleKeys: [...PREMIUM_MODULE_KEYS],
    sortOrder: 3,
  },
];

export const DEFAULT_PLAN_CODE: PlanCode = DEFAULT_PLAN_KEY;

export function normalizePlanCode(planCode: string | null | undefined): PlanCode {
  if (planCode === PLAN_KEYS.ESSENTIEL || planCode === PLAN_KEYS.BUSINESS || planCode === PLAN_KEYS.PREMIUM) {
    return planCode;
  }
  if (planCode === "pro") return PLAN_KEYS.PREMIUM;
  return DEFAULT_PLAN_CODE;
}

export function getPlanDefinition(planCode: string | null | undefined): SubscriptionPlanDefinition {
  const normalized = normalizePlanCode(planCode);
  return SUBSCRIPTION_PLANS.find((plan) => plan.code === normalized) ?? SUBSCRIPTION_PLANS.find((plan) => plan.code === DEFAULT_PLAN_CODE)!;
}

export function getEnabledModulesForPlan(planCode: string | null | undefined): string[] {
  return getModulesForPlan(normalizePlanCode(planCode));
}
