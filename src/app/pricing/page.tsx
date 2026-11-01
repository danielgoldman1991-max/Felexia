import { LandingContact } from "@/components/landing/LandingContact";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { createPublicMetadata } from "@/lib/seo";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

const essential = getPlanDefinition("essentiel");
export const metadata = createPublicMetadata({
  title: "Tarifs ESSENTIEL et PRO sur devis | Felexia",
  description: `ESSENTIEL à ${essential.monthlyPrice} HT MAD/mois ou ${essential.yearlyPrice.toLocaleString("fr-FR")} HT MAD/an, essai de ${DEFAULT_TRIAL_DURATION_LABEL} sans carte bancaire. PRO, l’ERP complet, uniquement sur devis.`,
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div id="top" className="landing marketing-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingPricing standalone />
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingEffects />
    </div>
  );
}
