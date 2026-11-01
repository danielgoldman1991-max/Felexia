"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, BookOpen, Check, CheckCheck, FileText, Landmark } from "lucide-react";
import "./landing-journey.css";

const chapters = [
  {
    name: "Facturer",
    eyebrow: "01 / DONNEZ FORME À VOTRE TRAVAIL",
    title: "Une belle facture.\nUn bon départ.",
    description: "Créez vos factures de vente avec votre identité, vos lignes et votre TVA. Retrouvez vos clients et les montants restant à régler sans disperser vos informations.",
    features: ["Votre logo et votre ICE", "Factures PDF personnalisées", "Clients et fournisseurs centralisés"],
    icon: FileText,
  },
  {
    name: "Encaisser",
    eyebrow: "02 / SUIVEZ CE QUI SE CONCRÉTISE",
    title: "Le règlement arrive.\nTout se relie.",
    description: "Enregistrez les règlements de vos clients et les paiements de vos fournisseurs. La facture, le montant réglé et le solde à recevoir restent à portée de main.",
    features: ["Encaissements et paiements", "Soldes des factures", "Banques et caisses"],
    icon: ArrowDownLeft,
  },
  {
    name: "Piloter",
    eyebrow: "03 / PRENEZ UN PEU DE HAUTEUR",
    title: "Les bons repères.\nLes idées plus claires.",
    description: "Consultez votre trésorerie, vos mouvements et les écritures associées à vos opérations. Vos ventes, vos achats et vos journaux racontent enfin la même histoire.",
    features: ["Mouvements et soldes", "Journaux de vente et d’achat", "Écritures liées aux opérations"],
    icon: Landmark,
  },
];

function InvoiceVisual() {
  return (
    <div className="journey-visual journey-invoice-visual">
      <div className="journey-appbar"><span className="journey-appmark">F.</span><span>Ventes / Factures</span><span className="journey-appbar-dot" /></div>
      <div className="journey-invoice-wrap">
        <div className="journey-invoice">
          <div className="journey-invoice-head"><span className="journey-invoice-monogram">votre<br /><strong>entreprise.</strong></span><span>FACTURE<b>FAC-001</b></span></div>
          <div className="journey-invoice-parties"><span>ÉMETTEUR<b>Votre entreprise</b><small>Coordonnées & ICE</small></span><span>DESTINATAIRE<b>Votre client</b><small>Coordonnées du client</small></span></div>
          <div className="journey-invoice-table-head"><span>Désignation</span><span>Montant HT</span></div>
          <div className="journey-invoice-line"><span>Prestation de services</span><span>1 000,00</span></div>
          <div className="journey-invoice-line journey-invoice-vat"><span>TVA</span><span>200,00</span></div>
          <div className="journey-invoice-total"><span>Total TTC</span><strong>1 200,00 <small>MAD</small></strong></div>
          <div className="journey-invoice-footer">Merci pour votre confiance.</div>
        </div>
        <div className="journey-invoice-chip"><FileText size={15} />Votre identité. Jusque dans les détails.</div>
      </div>
      <div className="journey-scene-footer"><span className="journey-scene-dot" />Une facture à votre image<ArrowRight size={15} /></div>
    </div>
  );
}

function PaymentVisual() {
  return (
    <div className="journey-visual journey-payment-visual">
      <div className="journey-appbar"><span className="journey-appmark">F.</span><span>Règlements / Encaissement</span><span className="journey-appbar-dot" /></div>
      <div className="journey-payment-wrap">
        <div className="journey-payment-check"><Check size={32} strokeWidth={1.7} /></div>
        <span className="journey-payment-label">Règlement enregistré</span>
        <strong className="journey-payment-amount">1 200<span>,00</span><small>MAD</small></strong>
        <div className="journey-payment-receipt">
          <div><span>Facture associée</span><strong>FAC-001</strong></div>
          <div><span>Compte</span><strong>Banque principale</strong></div>
          <div><span>Montant restant</span><strong>0,00 MAD</strong></div>
          <div className="journey-payment-receipt-status"><span>Statut de la facture</span><b><CheckCheck size={13} />Réglée</b></div>
        </div>
        <div className="journey-payment-link"><FileText size={16} /><span>Facture</span><i /><ArrowDownLeft size={16} /><span>Règlement</span><i /><Landmark size={16} /><span>Banque</span></div>
      </div>
      <div className="journey-scene-footer"><span className="journey-scene-dot" />De la facture au règlement<ArrowRight size={15} /></div>
    </div>
  );
}

function PilotVisual() {
  return (
    <div className="journey-visual journey-pilot-visual">
      <div className="journey-appbar"><span className="journey-appmark">F.</span><span>Trésorerie / Vue d’ensemble</span><span className="journey-appbar-dot" /></div>
      <div className="journey-pilot-wrap">
        <div className="journey-pilot-kpis"><div><span>Encaissements</span><strong>12 400<small>MAD</small></strong><i>Entrées</i></div><div><span>Décaissements</span><strong>8 200<small>MAD</small></strong><i>Sorties</i></div></div>
        <div className="journey-chart-card">
          <div className="journey-chart-title"><span>Mouvements de trésorerie</span><b>Vue illustrative</b></div>
          <div className="journey-chart">
            <svg viewBox="0 0 420 118" preserveAspectRatio="none"><path className="journey-chart-grid" d="M0 15H420M0 49H420M0 83H420M0 117H420" /><path className="journey-chart-area" d="M0 104L35 99L70 103L105 77L140 85L175 59L210 68L245 40L280 49L315 21L350 28L385 13L420 3V118H0Z" /><path className="journey-chart-line" d="M0 104L35 99L70 103L105 77L140 85L175 59L210 68L245 40L280 49L315 21L350 28L385 13L420 3" /></svg>
          </div>
          <div className="journey-chart-period"><span>Début de période</span><span>Fin de période</span></div>
        </div>
        <div className="journey-journal"><div><BookOpen size={16} /><span>Vos opérations, reliées aux journaux</span></div><div><span>Vente · FAC-001</span><b>1 200,00</b></div><div><span>Banque · Règlement reçu</span><b>1 200,00</b></div></div>
      </div>
      <div className="journey-scene-footer"><span className="journey-scene-dot" />Une vue d’ensemble, des détails accessibles<ArrowRight size={15} /></div>
    </div>
  );
}

const scenes = [InvoiceVisual, PaymentVisual, PilotVisual];

export function LandingJourney() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const desktopMotion = window.matchMedia("(min-width: 901px) and (min-height: 701px) and (prefers-reduced-motion: no-preference)");
    const latestEntries = new Map<Element, IntersectionObserverEntry>();
    let observer: IntersectionObserver | undefined;

    function configure() {
      if (!root) return;
      observer?.disconnect();
      latestEntries.clear();
      root.dataset.enhanced = String(desktopMotion.matches);
      if (!desktopMotion.matches) return;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) latestEntries.set(entry.target, entry);
        const focusY = window.innerHeight * 0.45;
        let nearestChapter: HTMLElement | undefined;
        let nearestDistance = Infinity;
        for (const entry of latestEntries.values()) {
          if (!entry.isIntersecting) continue;
          const rect = entry.target.getBoundingClientRect();
          const distance = Math.abs((rect.top + rect.bottom) / 2 - focusY);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestChapter = entry.target as HTMLElement;
          }
        }
        if (nearestChapter) setActiveIndex(Number(nearestChapter.dataset.chapter));
      }, { rootMargin: "-25% 0px -45% 0px", threshold: [0, 0.15, 0.4] });
      root.querySelectorAll<HTMLElement>("[data-chapter]").forEach((chapter) => observer?.observe(chapter));
    }

    configure();
    desktopMotion.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      desktopMotion.removeEventListener("change", configure);
      delete root.dataset.enhanced;
    };
  }, []);

  function goToChapter(index: number) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.querySelector<HTMLElement>(`[data-chapter="${index}"]`)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center" });
  }

  return (
    <section id="modules" className="journey-section" aria-labelledby="journey-title">
      <div className="marketing-container">
        <div className="journey-heading" data-reveal>
          <p className="marketing-eyebrow">VOTRE ACTIVITÉ, SANS LES DÉTOURS.</p>
          <h2 id="journey-title" className="marketing-section-title">Une facture. Un règlement.<br />Une vision plus claire.</h2>
          <p className="marketing-copy journey-heading-copy">L’essentiel de votre gestion, relié dans un même espace. Suivez le fil.</p>
        </div>
        <div ref={rootRef} id="features" className="journey-grid" data-active-chapter={activeIndex}>
          <div className="journey-chapters">
            {chapters.map((chapter, index) => {
              const Scene = scenes[index];
              return (
                <article key={chapter.name} id={`parcours-${chapter.name.toLowerCase()}`} className="journey-chapter" data-chapter={index} aria-labelledby={`journey-chapter-title-${index}`}>
                  <div className="journey-chapter-copy" data-reveal>
                    <span className="journey-chapter-eyebrow">{chapter.eyebrow}</span>
                    <h3 id={`journey-chapter-title-${index}`}>{chapter.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
                    <p>{chapter.description}</p>
                    <ul>{chapter.features.map((feature) => <li key={feature}><Check size={14} aria-hidden="true" />{feature}</li>)}</ul>
                    <span className="journey-chapter-name"><chapter.icon size={17} aria-hidden="true" />{chapter.name}<ArrowRight size={15} aria-hidden="true" /></span>
                  </div>
                  <div className="journey-inline-visual" aria-hidden="true"><Scene /><p className="journey-illustration-note">Aperçu illustratif · Données fictives</p></div>
                </article>
              );
            })}
          </div>
          <div className="journey-stage">
            <nav className="journey-stage-nav" aria-label="Étapes de votre gestion">
              {chapters.map((chapter, index) => <button key={chapter.name} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => goToChapter(index)}><span>0{index + 1}</span>{chapter.name}</button>)}
            </nav>
            <div className="journey-stage-scenes" aria-hidden="true">
              {scenes.map((Scene, index) => <div key={chapters[index].name} className="journey-stage-layer" data-current={index === activeIndex}><Scene /></div>)}
            </div>
            <p className="journey-illustration-note">Aperçus illustratifs · Données fictives</p>
          </div>
        </div>
      </div>
    </section>
  );
}
