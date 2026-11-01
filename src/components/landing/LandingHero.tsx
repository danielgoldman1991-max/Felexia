import Image from "next/image";
import Link from "next/link";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "./landing-horizon.css";

export function LandingHero() {
  return (
    <section className="horizon-hero" aria-labelledby="hero-title">
      <div className="horizon-window">
        <div className="horizon-landscape" aria-hidden="true">
          <Image src="/images/felexia-horizon-v1.png" alt="" fill preload sizes="100vw" className="horizon-image" />
        </div>
        <div className="horizon-shade" aria-hidden="true" />
        <div className="horizon-copy">
          <h1 id="hero-title">Votre entreprise, l’esprit libre.</h1>
          <p>Vos factures, vos règlements, votre trésorerie.<br />{" "}Tout simplement, au même endroit.</p>
          <div className="horizon-actions">
            <Link href="/login?mode=register" className="horizon-start">Démarrer gratuitement</Link>
            <a href="#modules" className="horizon-discover">Découvrir Felexia</a>
          </div>
          <span className="horizon-trial">{DEFAULT_TRIAL_DURATION_LABEL} d’essai gratuit · Sans carte bancaire</span>
        </div>
      </div>
    </section>
  );
}
