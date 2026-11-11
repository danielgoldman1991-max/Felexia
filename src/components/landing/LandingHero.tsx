import Link from "next/link";
import { ResponsiveImage } from "@/components/seo/ResponsiveImage";
import { LandingLaptopInterface } from "./LandingLaptopInterface";
import { LandingZoomPreference } from "./LandingZoomPreference";
import "./landing-horizon.css";

export function LandingHero() {
  return (
    <section className="horizon-hero" aria-labelledby="hero-title">
      <div className="horizon-window">
        <div className="horizon-landscape" aria-hidden="true">
          <div className="horizon-world">
            <ResponsiveImage
              pictureClassName="horizon-picture"
              className="horizon-image"
              avif="/images/felexia-horizon-v1.avif"
              webp="/images/felexia-horizon-v1.webp"
              alt="Paysage illustratif au-dessus d’un écran Felexia, aperçu du logiciel de gestion pour PME au Maroc. Données fictives."
              width={1672}
              height={941}
              priority
            />
          </div>
          <div className="horizon-immersion" />
          <div className="horizon-laptop">
            <div className="horizon-screen">
              <LandingLaptopInterface />
            </div>
          </div>
        </div>
        <div className="horizon-shade" aria-hidden="true" />
        <div className="horizon-copy">
          <p className="horizon-eyebrow">Logiciel de gestion & ERP · PME au Maroc</p>
          <h1 id="hero-title"><span>Votre entreprise.</span>{" "}<span>Une vision plus claire.</span></h1>
          <p className="horizon-tagline">Facturez. Suivez vos coûts. Pilotez en toute liberté.</p>
          <div className="horizon-actions">
            <Link className="marketing-button marketing-button-primary" href="/login?mode=register">Essayer gratuitement</Link>
            <Link className="marketing-button horizon-action-secondary" href="/#pricing">Voir les offres</Link>
          </div>
          <LandingZoomPreference />
        </div>
        <a className="horizon-scroll-cue" href="#essentiel" aria-label="Défiler pour découvrir — Découvrez la suite">
          <span className="horizon-cue-enter">Défiler pour découvrir</span>
          <span className="horizon-cue-next" aria-hidden="true">Découvrez la suite</span>
          <svg viewBox="0 0 16 24" width="12" height="19" fill="none" aria-hidden="true"><path d="M8 1v20m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    </section>
  );
}
