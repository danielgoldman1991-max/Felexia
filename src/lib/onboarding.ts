import { createClient } from "@/lib/supabase/server";

export type OnboardingChecklistStepKey =
  | "company"
  | "prospect"
  | "article"
  | "treasury"
  | "quote"
  | "pdf";

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
  progress: number;
  steps: OnboardingChecklistStep[];
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function countCompleted(steps: OnboardingChecklistStep[]) {
  return steps.filter((step) => step.completed).length;
}

export async function getOnboardingChecklist(
  organizationId: string,
): Promise<OnboardingChecklist> {
  const supabase = await createClient();

  const [{ data: organization }, { data: companySettings }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, address, city, phone, email, logo_url")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("organization_id, legal_name, address, city, phone, email, logo_url")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const companyInfoCompleted = [
    organization?.name ?? companySettings?.legal_name,
    organization?.address ?? companySettings?.address,
    organization?.city ?? companySettings?.city,
    organization?.phone ?? companySettings?.phone,
    organization?.email ?? companySettings?.email,
  ].every(hasText);
  const logoCompleted = hasText(organization?.logo_url) || hasText(companySettings?.logo_url);
  const companyCompleted = companyInfoCompleted && logoCompleted;

  const [
    { count: prospectCount },
    { count: productCount },
    { count: treasuryAccountCount },
    { count: quoteCount },
    { count: printableQuoteCount },
    { data: latestQuote },
  ] = await Promise.all([
    supabase
      .from("third_parties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .contains("types", ["prospect"])
      .neq("status", "archived"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    supabase
      .from("treasury_accounts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("archived_at", null),
    supabase
      .from("sales_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("document_type", "quote")
      .neq("status", "cancelled"),
    supabase
      .from("sales_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("document_type", "quote")
      .not("status", "in", "(draft,cancelled)"),
    supabase
      .from("sales_documents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("document_type", "quote")
      .not("status", "in", "(draft,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hasProspect = (prospectCount ?? 0) > 0;
  const hasArticle = (productCount ?? 0) > 0;
  const hasTreasuryAccount = (treasuryAccountCount ?? 0) > 0;
  const hasQuote = (quoteCount ?? 0) > 0;
  const hasPrintableQuote = (printableQuoteCount ?? 0) > 0;
  const pdfHref = latestQuote?.id
    ? `/vente/devis/${latestQuote.id}/print`
    : "/vente/devis";

  const steps: OnboardingChecklistStep[] = [
    {
      key: "company",
      title: "Configurer mon entreprise",
      description: "Adresse, coordonnées, informations légales, logo",
      href: "/parametres/entreprise",
      completed: companyCompleted,
    },
    {
      key: "prospect",
      title: "Ajouter mon premier prospect",
      description: "Nom, coordonnées, besoin identifié",
      href: "/tiers/new?type=prospect",
      completed: hasProspect,
    },
    {
      key: "article",
      title: "Ajouter mon premier article",
      description: "Produit, service, prix et TVA",
      href: "/articles/new?type=product",
      completed: hasArticle,
    },
    {
      key: "treasury",
      title: "Ajouter mes comptes & caisses",
      description: "Banques, caisses et moyens de paiement",
      href: "/tresorerie/comptes",
      completed: hasTreasuryAccount,
    },
    {
      key: "quote",
      title: "Créer mon premier devis",
      description: "Préparer une première proposition commerciale",
      href: "/vente/devis/new",
      completed: hasQuote,
    },
    {
      key: "pdf",
      title: "Générer mon premier PDF",
      description: "Valider et télécharger",
      href: pdfHref,
      completed: hasPrintableQuote,
    },
  ];

  const completedCount = countCompleted(steps);

  return {
    organizationName:
      (organization?.name as string | null | undefined) ??
      (companySettings?.legal_name as string | null | undefined) ??
      "votre entreprise",
    completedCount,
    totalCount: steps.length,
    progress: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    steps,
  };
}

export function isOnboardingChecklistComplete(checklist: OnboardingChecklist) {
  return checklist.completedCount >= checklist.totalCount;
}
