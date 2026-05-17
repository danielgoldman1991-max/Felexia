import { createClient } from "@/lib/supabase/server";

export type OnboardingChecklistStepKey =
  | "company"
  | "client"
  | "invoice"
  | "pdf"
  | "logo";

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

  const companyCompleted = [
    organization?.name ?? companySettings?.legal_name,
    organization?.address ?? companySettings?.address,
    organization?.city ?? companySettings?.city,
    organization?.phone ?? companySettings?.phone,
    organization?.email ?? companySettings?.email,
  ].every(hasText);
  const logoCompleted = hasText(organization?.logo_url) || hasText(companySettings?.logo_url);

  const [
    { count: customerCount },
    { count: quoteCount },
    { count: printableQuoteCount },
    { data: latestQuote },
  ] = await Promise.all([
    supabase
      .from("third_parties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .contains("types", ["customer"])
      .neq("status", "archived"),
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

  const hasClient = (customerCount ?? 0) > 0;
  const hasQuote = (quoteCount ?? 0) > 0;
  const hasPrintableQuote = (printableQuoteCount ?? 0) > 0;
  const pdfHref = latestQuote?.id
    ? `/vente/devis/${latestQuote.id}/print`
    : "/vente/devis";

  const steps: OnboardingChecklistStep[] = [
    {
      key: "company",
      title: "Configurer mon entreprise",
      description: "Adresse, coordonnées, informations légales",
      href: "/parametres/entreprise",
      completed: companyCompleted,
    },
    {
      key: "client",
      title: "Ajouter mon premier client",
      description: "Nom, ICE, coordonnées",
      href: "/tiers/new?type=customer",
      completed: hasClient,
    },
    {
      key: "invoice",
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
    {
      key: "logo",
      title: "Personnaliser mon logo",
      description: "Apparaît sur vos documents",
      href: "/parametres/entreprise#logo",
      completed: logoCompleted,
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
