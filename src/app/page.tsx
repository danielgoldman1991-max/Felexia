import type { Metadata } from "next";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingEffects } from "@/components/landing/LandingEffects";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata: Metadata = {
  title: "Felexia Pro — Factures, achats et trésorerie au Maroc",
  description:
    "Créez votre entreprise, vos factures de vente et d’achat, enregistrez vos règlements et suivez votre trésorerie et vos journaux avec Felexia Pro.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "Felexia Pro — Factures, achats et trésorerie au Maroc",
    description:
      "Factures de vente et d’achat, règlements, trésorerie et journaux : l’essentiel pour démarrer simplement.",
  },
};

export default function LandingPage() {
  return (
    <div id="top" className="landing marketing-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingStory />
        <LandingPricing />
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingEffects />
    </div>
  );
}
