import type { Metadata } from "next";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingComparison } from "@/components/landing/LandingComparison";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingModules } from "@/components/landing/LandingModules";
import { LandingMorocco } from "@/components/landing/LandingMorocco";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingProofStrip } from "@/components/landing/LandingProofStrip";
import { LandingResources } from "@/components/landing/LandingResources";
import { LandingWhy } from "@/components/landing/LandingWhy";
import { LandingWorkflow } from "@/components/landing/LandingWorkflow";

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
    <div className="landing min-h-screen overflow-x-clip bg-white text-slate-950 antialiased">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingProofStrip />
        <LandingModules />
        <LandingWorkflow />
        <LandingWhy />
        <LandingFeatures />
        <LandingMorocco />
        <LandingPricing />
        <LandingComparison />
        <LandingResources />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}
