import Image from "next/image";
import Link from "next/link";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import { LandingLaptopInterface } from "./LandingLaptopInterface";
import "./landing-horizon.css";

export function LandingHero() {
  return (
    <section className="horizon-hero" aria-labelledby="hero-title">
      <div className="horizon-window">
        <div className="horizon-landscape" aria-hidden="true">
          <div className="horizon-world">
            <Image src="/images/felexia-horizon-v1.png" alt="" fill preload sizes="(max-aspect-ratio: 1672/941) 178vh, 100vw" className="horizon-image" />
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
          <h1 id="hero-title">La facturation électronique, simplement.</h1>
          <p>Du PDF au XML, jusqu’à l’archivage.<br />{" "}Vos factures et leur suivi, dans un seul espace.</p>
          <div className="horizon-actions">
            <Link href="/login?mode=register" className="horizon-start">Démarrer gratuitement</Link>
            <a href="#facturation-electronique" className="horizon-discover" aria-label="En savoir plus sur la facturation électronique">En savoir plus</a>
          </div>
          <span className="horizon-trial">{DEFAULT_TRIAL_DURATION_LABEL} d’essai gratuit · Sans carte bancaire</span>
        </div>
        <a className="horizon-scroll-cue" href="#facturation-electronique" aria-label="Découvrir la facturation électronique">
          <span className="horizon-cue-enter">Défiler pour découvrir</span>
          <span className="horizon-cue-next" aria-hidden="true">Découvrez la suite</span>
          <svg viewBox="0 0 16 24" width="12" height="19" fill="none" aria-hidden="true"><path d="M8 1v20m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    </section>
  );
}
