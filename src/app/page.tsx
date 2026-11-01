import type { Metadata } from "next";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingEssentiel } from "@/components/landing/LandingEssentiel";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingPro } from "@/components/landing/LandingPro";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingEffects } from "@/components/landing/LandingEffects";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata: Metadata = {
  title: "Felexia — ESSENTIEL et PRO, votre ERP au Maroc",
  description:
    "Gérez votre entreprise avec ESSENTIEL : ventes, achats, clients, fournisseurs et trésorerie. PRO sur devis pour l’ERP complet au Maroc. Facturation électronique incluse.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "Felexia — ESSENTIEL et PRO, votre ERP au Maroc",
    description:
      "ESSENTIEL pour les ventes, les achats et la trésorerie de votre PME. PRO sur devis pour l’ERP complet. Facturation électronique PDF/XML incluse.",
  },
};

export default function LandingPage() {
  return (
    <div id="top" className="landing marketing-site marketing-horizon-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader overlay />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingEssentiel />
        <LandingPro />
        <LandingStory />
        <LandingPricing />
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingEffects />
    </div>
  );
}
