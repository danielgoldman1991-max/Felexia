import { LandingContact } from "@/components/landing/LandingContact";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPricing } from "@/components/landing/LandingPricing";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata = {
  title: "Tarifs - Felexia",
  description: "Une offre Essentiel pour vos factures de vente et d’achat, leurs règlements, votre trésorerie et vos journaux.",
};

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
