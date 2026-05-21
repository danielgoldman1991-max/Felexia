import { BUSINESS_MODULE_KEYS } from "@/lib/business-modules";

export type PlanCode = "essentiel" | "business" | "premium";

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
  "products",
  "quotes",
  "orders",
  "invoices",
  "payments",
  "documents",
  "import_export",
  "company_settings",
  "users_basic",
];

const BUSINESS_FEATURES: PlanFeatureKey[] = [
  ...ESSENTIEL_FEATURES,
  "leads",
  "pipeline",
  "advanced_orders",
  "delivery_notes",
  "credit_notes",
  "customer_reminders",
  "suppliers",
  "purchases",
  "receipt_notes",
  "supplier_invoices",
  "stock",
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
    description: "Pour demarrer avec une gestion commerciale simple et propre.",
    monthlyPrice: 290,
    yearlyPrice: 2900,
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
      "Tableau de bord simple",
      "Clients",
      "Produits / Services",
      "Devis, commandes et factures",
      "Paiements",
      "Documents",
      "Import / Export simple",
      "Parametres entreprise",
      "Gestion de base des utilisateurs",
    ],
    limitHighlights: [
      "1 organisation",
      "3 utilisateurs maximum",
      "500 documents commerciaux / mois",
      "Stockage limite",
      "Sans comptabilite avancee",
    ],
    moduleKeys: ["quotes", "invoicing", "documents", "crm", "stock"],
    sortOrder: 1,
  },
  {
    code: "business",
    name: "Business",
    description: "Le pack recommande pour piloter ventes, achats, stock et pre-comptabilite.",
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
      "Prospects / Leads",
      "Pipeline commercial",
      "Bons de livraison et avoirs",
      "Fournisseurs et achats simples",
      "Stock simple",
      "Documents avances",
      "Export CSV / Excel",
      "Preparation comptable et TVA",
      "Roles, permissions et historique",
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
    name: "Premium",
    description: "Pour les PME qui veulent un pilotage avance, la comptabilite complete et du support prioritaire.",
    monthlyPrice: 1290,
    yearlyPrice: 12900,
    currency: "MAD",
    isRecommended: false,
    limits: {
      organizations: 1,
      users: 25,
      commercialDocumentsPerMonth: null,
      storageMb: 20480,
    },
    features: PREMIUM_FEATURES,
    featureHighlights: [
      "Tout Business",
      "Permissions detaillees",
      "Gestion documentaire avancee",
      "Exports avances",
      "Comptabilite avancee",
      "Plan comptable marocain personnalisable",
      "Ecritures comptables automatiques",
      "TVA avancee",
      "Tableaux de bord et reporting avances",
      "Support prioritaire et accompagnement",
    ],
    limitHighlights: [
      "25 utilisateurs maximum",
      "Volume eleve de documents",
      "Stockage eleve",
      "Support prioritaire",
    ],
    moduleKeys: ["quotes", "invoicing", "documents", "crm", "purchases", "stock", "treasury", "accounting", "reports"],
    sortOrder: 3,
  },
];

export const DEFAULT_PLAN_CODE: PlanCode = "business";

export function normalizePlanCode(planCode: string | null | undefined): PlanCode {
  if (planCode === "essentiel" || planCode === "business" || planCode === "premium") {
    return planCode;
  }
  if (planCode === "pro") return "premium";
  return DEFAULT_PLAN_CODE;
}

export function getPlanDefinition(planCode: string | null | undefined): SubscriptionPlanDefinition {
  const normalized = normalizePlanCode(planCode);
  return SUBSCRIPTION_PLANS.find((plan) => plan.code === normalized) ?? SUBSCRIPTION_PLANS[1];
}

export function getEnabledModulesForPlan(planCode: string | null | undefined): string[] {
  return getPlanDefinition(planCode).moduleKeys;
}
