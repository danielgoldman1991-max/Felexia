"use client";

import { ArrowRight, Check, CreditCard, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProGuideCta } from "@/components/marketing/ProGuideCta";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { filterPubliclyAvailablePlans, isPlanQuoteOnly } from "@/lib/subscriptions/commercial-offers";
import { getProQuoteHref, getProWhatsAppHref } from "@/lib/subscriptions/quote-contact";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "./landing-conversion.css";

const formatPrice = (value: number) => value.toLocaleString("fr-FR");
const essentialFeatures = [
  "Factures de vente, PDF et votre logo",
  "Facturation électronique PDF/XML et archivage",
  "Règlements clients",
  "Journaux comptables",
  "Jusqu’à 3 utilisateurs",
  "Les devis, commandes et le stock sont dans PRO",
];
const proFeatures = [
  "Tout ESSENTIEL",
  "Devis, prospects, commandes et livraisons",
  "Bons de livraison et retours clients",
  "Commandes et réceptions fournisseurs",
  "Stock, emplacements et mouvements",
  "Plan comptable, grand livre et balance",
  "Préparation et suivi des déclarations TVA",
  "Prévisions et rapprochement de trésorerie",
  "Dossiers du personnel et paie préparatoire",
  "Gestion documentaire et tableaux de bord",
  "Jusqu’à 25 utilisateurs",
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
          <p className="marketing-eyebrow">Deux offres, la même ambition</p>
          <Heading id="conversion-pricing-title" className="marketing-section-title">{standalone ? <>Tarifs du logiciel de gestion<br />pour les PME au Maroc.</> : <>Un prix clair.<br />Un essai de {DEFAULT_TRIAL_DURATION_LABEL}.</>}</Heading>
          <p className="marketing-copy">{standalone ? "ESSENTIEL : factures, règlements et journaux. PRO : les devis et le reste de l’ERP, sur devis." : "Commencez par facturer avec ESSENTIEL. Passez à PRO pour les devis, le stock et l’équipe."}</p>
          <div className="conversion-trial-note">
            <span className="conversion-trial-icon"><Sparkles size={21} aria-hidden="true" /></span>
            <div><strong>{DEFAULT_TRIAL_DURATION_LABEL} d’essai ESSENTIEL.</strong><p>Découvrez votre espace gratuitement, sans carte bancaire. Pour PRO, échangeons sur votre projet.</p></div>
          </div>
          <div className="conversion-billing-toggle" data-yearly={yearly} role="group" aria-label="Période de facturation ESSENTIEL">
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Mensuel</button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Annuel</button>
          </div>
          <p className="conversion-pricing-aside">Vous hésitez entre les deux offres ? <a href="#contact">Parlons de votre activité <ArrowRight size={15} aria-hidden="true" /></a></p>
        </div>
        <div className="conversion-pricing-cards" data-reveal>
          {plans.map((plan) => {
            const isPro = isPlanQuoteOnly(plan.code);
            const features = isPro ? proFeatures : essentialFeatures;
            return (
              <article key={plan.code} className={`conversion-price-card${isPro ? " conversion-price-card-pro" : ""}`} aria-labelledby={`conversion-plan-${plan.code}`}>
                <div className="conversion-plan-topline"><PlanHeading id={`conversion-plan-${plan.code}`}>{plan.name}</PlanHeading><span className="conversion-plan-badge">{isPro ? "L’ERP complet" : "Votre gestion quotidienne"}</span></div>
                <p className="conversion-plan-description">{isPro ? "Les devis, les commandes, le stock et l’équipe. PRO reprend ESSENTIEL et va plus loin." : "Facturation, règlements et journaux comptables. Pas les devis : ils sont dans PRO."}</p>
                <div className="conversion-price-amount" aria-live="polite" aria-atomic="true">{isPro ? <strong>Sur devis</strong> : <><strong>{formatPrice(yearly ? plan.yearlyPrice : plan.monthlyPrice)}</strong><span> HT MAD <span>/{yearly ? "an" : "mois"}</span></span></>}</div>
                <p className="conversion-price-caption">{isPro ? "Aucun prix public. La proposition se fait avec l’équipe." : yearly ? `Soit 12 × ${formatPrice(plan.monthlyPrice)} MAD HT, sans remise.` : "Facturé chaque mois. L’annuel est le même tarif, sans remise."}</p>
                <Link href={isPro ? getProQuoteHref() : "/login?mode=register"} className={`marketing-button ${isPro ? "conversion-pro-button" : "marketing-button-primary"} conversion-price-button`}>{isPro ? "Demander un devis PRO" : "Essayer gratuitement"} <ArrowRight size={17} aria-hidden="true" /></Link>
                {isPro ? <a className="conversion-whatsapp" href={getProWhatsAppHref()}>Écrire sur WhatsApp</a> : null}
                <p className="conversion-no-card">{isPro ? <Mail size={14} aria-hidden="true" /> : <CreditCard size={14} aria-hidden="true" />} {isPro ? "L’e-mail reste possible, WhatsApp aussi" : `${DEFAULT_TRIAL_DURATION_LABEL} · sans carte bancaire`}</p>
                <div className="conversion-included-heading">{isPro ? "Tout ESSENTIEL, et plus loin" : "Inclus dans ESSENTIEL"}</div>
                <ul className="conversion-included-list">{features.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
                <p className="conversion-plan-limits">{isPro ? "1 entreprise · Documents commerciaux sans plafond mensuel · 20 Go de stockage" : "1 entreprise · 500 documents commerciaux / mois · 1 Go de stockage"}</p>
                {isPro ? <p className="conversion-plan-limits">Le devis précise les fonctions utilisables. Le détail des limites est dans le pied de page.</p> : null}
              </article>
            );
          })}
        </div>
        {standalone ? <ProGuideCta /> : null}
      </div>
    </section>
  );
}
