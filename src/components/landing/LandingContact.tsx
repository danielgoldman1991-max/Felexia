import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";

export function LandingContact() {
  const email = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
  return (
    <section id="contact" aria-labelledby="conversion-contact-title" className="conversion-contact">
      <div className="marketing-container">
        <div className="conversion-contact-panel" data-reveal>
          <span className="conversion-contact-watermark" aria-hidden="true">felexia.</span>
          <div className="conversion-contact-art" aria-hidden="true">
            <span className="conversion-orbit-ground" />
            <span className="conversion-orbit conversion-orbit-one" />
            <span className="conversion-orbit conversion-orbit-two" />
            <span className="conversion-orbit conversion-orbit-three" />
            <span className="conversion-orbit-center" />
            <span className="conversion-orbit conversion-orbit-front" />
            <span className="conversion-orbit-satellite conversion-orbit-satellite-mint" />
            <span className="conversion-orbit-satellite conversion-orbit-satellite-blue" />
            <span className="conversion-orbit-caption">Votre entreprise, connectée.</span>
          </div>
          <div className="conversion-contact-content">
            <p className="conversion-contact-eyebrow">Moins de gestion. Plus d’élan.</p>
            <h2 id="conversion-contact-title">Faites de la place<br />à votre entreprise.</h2>
            <p>ESSENTIEL pour votre quotidien, PRO pour tout piloter.<br />Votre nouveau départ commence ici.</p>
            <Link href="/login?mode=register" className="marketing-button conversion-contact-start">Démarrer gratuitement <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="conversion-contact-bottom">
            <div><Mail size={18} aria-hidden="true" /><p>Une question sur ESSENTIEL ou PRO ?<br /><span>Échangeons sur votre activité.</span></p></div>
            <a href={`mailto:${email}?subject=${encodeURIComponent("Felexia — offres ESSENTIEL et PRO")}`}>{email} <ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
