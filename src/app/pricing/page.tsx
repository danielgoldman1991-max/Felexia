import { LandingContact } from "@/components/landing/LandingContact";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPricing } from "@/components/landing/LandingPricing";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata = {
  title: "Tarifs ESSENTIEL et PRO - Felexia",
  description: "ESSENTIEL pour gérer vos ventes, achats, clients, fournisseurs et trésorerie. PRO sur devis pour l’ERP complet : stock, comptabilité et RH. Facturation électronique incluse.",
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
