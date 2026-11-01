"use client";

import { ArrowRight, Check, CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { filterPubliclyAvailablePlans } from "@/lib/subscriptions/commercial-offers";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "./landing-conversion.css";

const formatPrice = (value: number) => value.toLocaleString("fr-FR");
const includedFeatures = [
  "Votre espace entreprise", "Clients et fournisseurs", "Factures de vente", "Factures d’achat",
  "Règlements clients et fournisseurs", "Comptes bancaires et caisses", "Mouvements de trésorerie",
  "Journaux et écritures", "Factures PDF avec votre logo", "Jusqu’à 3 utilisateurs",
];

export function LandingPricing({ standalone = false }: { standalone?: boolean }) {
  const [yearly, setYearly] = useState(false);
  const plans = [...filterPubliclyAvailablePlans(SUBSCRIPTION_PLANS)].sort((a, b) => a.sortOrder - b.sortOrder);
  const Heading = standalone ? "h1" : "h2";
  const PlanHeading = standalone ? "h2" : "h3";

  return (
    <section id="pricing" aria-labelledby="conversion-pricing-title" className="conversion-pricing">
      <div className="marketing-container conversion-pricing-grid">
        <div className="conversion-pricing-intro" data-reveal>
          <p className="marketing-eyebrow">Simple, jusque dans le prix</p>
          <Heading id="conversion-pricing-title" className="marketing-section-title">Votre ambition.<br />Un seul abonnement.</Heading>
          <p className="marketing-copy">Factures, règlements, trésorerie. Tout l’essentiel de votre gestion, dans une formule claire, pensée pour les PME marocaines.</p>
          <div className="conversion-trial-note">
            <span className="conversion-trial-icon"><Sparkles size={21} aria-hidden="true" /></span>
            <div><strong>{DEFAULT_TRIAL_DURATION_LABEL} pour prendre vos repères.</strong><p>Découvrez Felexia gratuitement, sans carte bancaire.</p></div>
          </div>
          <p className="conversion-pricing-aside">Votre activité évolue ?<br /><a href="#contact">Parlons de vos besoins en modules complémentaires <ArrowRight size={15} aria-hidden="true" /></a></p>
        </div>
        <div className="conversion-pricing-cards" data-reveal>
          {plans.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const yearlySaving = plan.monthlyPrice * 12 - plan.yearlyPrice;
            const freeMonths = yearlySaving / plan.monthlyPrice;
            return (
              <article key={plan.code} className="conversion-price-card" aria-labelledby={`conversion-plan-${plan.code}`}>
                <div className="conversion-plan-topline"><PlanHeading id={`conversion-plan-${plan.code}`}>{plan.name}</PlanHeading><span className="conversion-plan-badge">Votre quotidien, simplifié</span></div>
                <div className="conversion-billing-toggle" role="group" aria-label="Période de facturation">
                  <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Mensuel</button>
                  <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Annuel{yearlySaving > 0 && <span>{Number.isInteger(freeMonths) ? `${freeMonths} mois offerts` : `−${formatPrice(yearlySaving)} MAD`}</span>}</button>
                </div>
                <div className="conversion-price-amount" aria-live="polite" aria-atomic="true"><strong>{formatPrice(price)}</strong><span>MAD <span>/ {yearly ? "an" : "mois"}</span></span></div>
                <p className="conversion-price-caption">{yearly ? "Facturé annuellement." : "Facturé mensuellement."} Commencez par votre essai gratuit.</p>
                <Link href="/login?mode=register" className="marketing-button marketing-button-primary conversion-price-button">Démarrer gratuitement <ArrowRight size={17} aria-hidden="true" /></Link>
                <p className="conversion-no-card"><CreditCard size={14} aria-hidden="true" /> Sans carte bancaire · Sans engagement</p>
                <div className="conversion-included-heading">Inclus dans votre espace</div>
                <ul className="conversion-included-list">{includedFeatures.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
