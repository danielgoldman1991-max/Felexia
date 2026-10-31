import { createClient } from "@/lib/supabase/server";

export type OnboardingChecklistStepKey = "company" | "customer" | "supplier" | "treasury" | "invoice";
export type OnboardingChecklistStep = {
  key: OnboardingChecklistStepKey;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};
export type OnboardingChecklist = {
  organizationName: string;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
  progress: number;
  steps: OnboardingChecklistStep[];
};
const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export async function getOnboardingChecklist(organizationId: string): Promise<OnboardingChecklist> {
  const supabase = await createClient();
  const [organization, settings, customers, suppliers, accounts, invoices] = await Promise.all([
    supabase.from("organizations").select("name, address, city").eq("id", organizationId).maybeSingle(),
    supabase.from("company_settings").select("legal_name, address, city").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("third_parties").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).contains("types", ["customer"]).neq("status", "archived"),
    supabase.from("third_parties").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).contains("types", ["supplier"]).neq("status", "archived"),
    supabase.from("treasury_accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active").is("archived_at", null),
    supabase.from("customer_invoices").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "cancelled").is("archived_at", null),
  ]);
  const company = {
    name: organization.data?.name || settings.data?.legal_name,
    address: organization.data?.address || settings.data?.address,
    city: organization.data?.city || settings.data?.city,
  };
  const steps: OnboardingChecklistStep[] = [
    { key: "company", title: "Vérifier mon entreprise", description: "Vos coordonnées et informations affichées sur vos factures", href: "/parametres/entreprise", completed: [company.name, company.address, company.city].every(hasText) },
    { key: "customer", title: "Ajouter un client", description: "Le destinataire de votre première facture de vente", href: "/tiers/new?type=customer", completed: (customers.count ?? 0) > 0 },
    { key: "supplier", title: "Ajouter un fournisseur", description: "Pour enregistrer vos factures d’achat", href: "/tiers/new?type=supplier", completed: (suppliers.count ?? 0) > 0 },
    { key: "treasury", title: "Ajouter un compte ou une caisse", description: "Pour enregistrer vos encaissements et vos paiements", href: "/tresorerie/comptes/new", completed: (accounts.count ?? 0) > 0 },
    { key: "invoice", title: "Créer ma première facture", description: "Saisissez vos prestations ou produits directement dans la facture", href: "/facturation/factures/new", completed: (invoices.count ?? 0) > 0 },
  ];
  const completedCount = steps.filter((step) => step.completed).length;
  return {
    organizationName: company.name || "votre entreprise",
    completedCount, totalCount: steps.length, isCompleted: completedCount === steps.length,
    progress: Math.round(completedCount / steps.length * 100), steps,
  };
}
export function isOnboardingChecklistComplete(checklist: OnboardingChecklist) {
  return checklist.isCompleted;
}
