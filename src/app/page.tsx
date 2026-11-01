import type { Metadata } from "next";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingEinvoicing } from "@/components/landing/LandingEinvoicing";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingPro } from "@/components/landing/LandingPro";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingEffects } from "@/components/landing/LandingEffects";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata: Metadata = {
  title: "Felexia — ESSENTIEL et PRO, votre ERP au Maroc",
  description:
    "ESSENTIEL pour facturer et suivre votre trésorerie. PRO sur devis pour l’ERP complet : ventes, achats, stock, comptabilité, TVA et ressources humaines au Maroc.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "Felexia — ESSENTIEL et PRO, votre ERP au Maroc",
    description:
      "Deux offres pour votre PME : la gestion quotidienne avec ESSENTIEL, l’ERP complet avec PRO sur devis. Facturation électronique PDF/XML incluse.",
  },
};

export default function LandingPage() {
  return (
    <div id="top" className="landing marketing-site marketing-horizon-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader overlay />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingEinvoicing />
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
