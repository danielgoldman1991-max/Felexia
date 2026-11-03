import { JsonLd } from "@/components/seo/JsonLd";
import { HOME_FAQS } from "@/lib/content/public-faq";
import { createPublicMetadata, getFaqPageStructuredData, getSoftwareApplicationStructuredData, SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE } from "@/lib/seo";
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

export const metadata = createPublicMetadata({ title: SEO_DEFAULT_TITLE, description: SEO_DEFAULT_DESCRIPTION, path: "/" });

export default function LandingPage() {
  return (
    <div id="top" className="landing marketing-site marketing-horizon-site">
      <JsonLd id="felexia-software-schema" data={getSoftwareApplicationStructuredData()} />
      <JsonLd id="felexia-home-faq" data={getFaqPageStructuredData(HOME_FAQS, "/")} />
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
