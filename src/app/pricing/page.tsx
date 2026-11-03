import { Plus } from "lucide-react";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { JsonLd } from "@/components/seo/JsonLd";
import { PRICING_FAQS } from "@/lib/content/public-faq";
import { createPublicMetadata, getFaqPageStructuredData, getSoftwareApplicationStructuredData } from "@/lib/seo";
import "@/components/landing/landing-story.css";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

const essential = getPlanDefinition("essentiel");
export const metadata = createPublicMetadata({
  title: "Tarifs du logiciel de gestion PME au Maroc | Felexia",
  description: `Tarifs du logiciel de gestion pour PME au Maroc : ESSENTIEL à ${essential.monthlyPrice} HT MAD/mois ou ${essential.yearlyPrice.toLocaleString("fr-FR")} HT MAD/an, essai de ${DEFAULT_TRIAL_DURATION_LABEL} sans carte. ERP PRO et stock, uniquement sur devis.`,
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div id="top" className="landing marketing-site">
      <JsonLd id="felexia-pricing-software" data={getSoftwareApplicationStructuredData()} />
      <JsonLd id="felexia-pricing-faq" data={getFaqPageStructuredData(PRICING_FAQS, "/pricing")} />
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingPricing standalone />
        <section id="faq" className="story-faq-section" aria-labelledby="pricing-faq-title">
          <div className="marketing-container story-faq-grid">
            <div>
              <p className="marketing-eyebrow">TARIFS</p>
              <h2 id="pricing-faq-title" className="marketing-section-title">Questions sur les tarifs<br />du logiciel de gestion.</h2>
              <p className="marketing-copy story-faq-intro">Les montants ESSENTIEL sont ceux du catalogue public. PRO reste sur devis.</p>
            </div>
            <div className="story-faq-list">
              {PRICING_FAQS.map((item) => (
                <details key={item.question} className="story-faq-item">
                  <summary>{item.question}<Plus className="story-faq-plus" size={19} aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingEffects />
    </div>
  );
}
