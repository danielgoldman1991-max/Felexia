import type { Metadata } from "next";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingEinvoicing } from "@/components/landing/LandingEinvoicing";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingEffects } from "@/components/landing/LandingEffects";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

export const metadata: Metadata = {
  title: "Felexia Pro — Facturation électronique au Maroc",
  description:
    "Générez vos factures électroniques en PDF et XML, émettez-les et archivez-les avec Felexia Pro. Suivez aussi vos règlements et votre trésorerie.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "Felexia Pro — Facturation électronique au Maroc",
    description:
      "Factures électroniques PDF/XML, émission et archivage : vos documents et votre gestion réunis dans un seul espace.",
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
        <LandingStory />
        <LandingPricing />
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingEffects />
    </div>
  );
}
