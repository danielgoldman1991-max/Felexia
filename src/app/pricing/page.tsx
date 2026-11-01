import { LandingContact } from "@/components/landing/LandingContact";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPricing } from "@/components/landing/LandingPricing";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata = {
  title: "Tarifs ESSENTIEL et PRO - Felexia",
  description: "Comparez ESSENTIEL pour la facturation électronique et la gestion quotidienne, et PRO pour l’ERP complet : ventes, achats, stock, comptabilité, TVA et RH.",
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
