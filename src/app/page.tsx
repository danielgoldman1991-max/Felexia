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
  title: "FelexiaERP — Mini ERP moderne pour PME au Maroc",
  description:
    "Gérez ventes, achats, stock, trésorerie, comptabilité, documents et prévisions dans une plateforme SaaS simple et professionnelle adaptée aux PME marocaines.",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    title: "FelexiaERP — Mini ERP moderne pour PME au Maroc",
    description:
      "Ventes, achats, stock, trésorerie, comptabilité et prévisions : toute votre PME dans un seul outil.",
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
