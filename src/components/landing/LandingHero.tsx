import Link from "next/link";
import { ArrowDown, ArrowRight, Check, MoveUpRight } from "lucide-react";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import { LandingProductScene } from "./LandingProductScene";

export function LandingHero() {
  return (
    <section className="marketing-hero" aria-labelledby="hero-title">
      <div className="marketing-hero-atmosphere" aria-hidden="true"><span /><span /><span /></div>
      <div className="marketing-container">
        <div className="marketing-hero-grid">
          <div className="marketing-hero-copy">
            <p className="marketing-hero-label"><span />La gestion des PME marocaines, simplement.</p>
            <h1 id="hero-title"><span className="marketing-title-line">L’esprit libre.</span><span className="marketing-title-line">Les affaires</span><span className="marketing-title-line marketing-title-accent">bien en main.</span></h1>
            <p className="marketing-hero-description">Vos factures, vos achats et votre trésorerie se retrouvent enfin. Un seul espace pour avancer, avec une vision claire de votre activité.</p>
            <div className="marketing-hero-actions">
              <Link href="/login?mode=register" className="marketing-button marketing-button-primary">Démarrer gratuitement<ArrowRight size={17} aria-hidden="true" /></Link>
              <a href="#modules" className="marketing-hero-explore">Explorer Felexia<MoveUpRight size={16} aria-hidden="true" /></a>
            </div>
            <div className="marketing-hero-reassurance">
              <span><Check size={14} aria-hidden="true" />{DEFAULT_TRIAL_DURATION_LABEL} d’essai gratuit</span>
              <span><Check size={14} aria-hidden="true" />Sans carte bancaire</span>
            </div>
          </div>
          <div className="marketing-hero-stage"><LandingProductScene /></div>
        </div>
        <div className="marketing-hero-baseline">
          <p>Moins de dispersion.<br /><strong>Plus de perspectives.</strong></p>
          <div className="marketing-hero-capabilities" aria-label="Les essentiels Felexia">
            <span><i>01</i>Facturer</span><span><i>02</i>Encaisser</span><span><i>03</i>Piloter</span>
          </div>
          <a href="#modules" className="marketing-scroll-cue" aria-label="Découvrir les fonctionnalités"><ArrowDown size={19} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
