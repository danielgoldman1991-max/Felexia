import Link from "next/link";
import { ArrowUpRight, Globe2, Plus } from "lucide-react";
import { HOME_FAQS } from "@/lib/content/public-faq";
import { LandingJourney } from "./LandingJourney";
import "./landing-story.css";

const questions = HOME_FAQS;

export function LandingStory() {
  return (
    <>
      <LandingJourney />

      <section id="why" className="story-context-section" aria-labelledby="story-context-title">
        <div className="marketing-container story-context-grid">
          <div data-reveal>
            <p className="marketing-eyebrow story-context-eyebrow">VOTRE ENTREPRISE A SON TERRAIN.</p>
            <h2 id="story-context-title" className="marketing-section-title story-context-title">
              Un logiciel de gestion<br />pensé pour le Maroc.
            </h2>
            <p className="story-context-copy">Le quotidien d’une PME marocaine mérite des outils qui parlent sa langue. Felexia rassemble la facturation, la trésorerie et vos repères, sans compliquer votre gestion.</p>
            <Link href="/login?mode=register" className="story-context-link">Créer mon espace entreprise<ArrowUpRight size={19} aria-hidden="true" /></Link>
          </div>
          <div className="story-context-features" data-reveal>
            <div className="story-local-mark" aria-hidden="true"><Globe2 size={22} /><span>MAROC / CONNECTÉ À VOTRE QUOTIDIEN</span><span className="story-live-dot" /></div>
            <div className="story-context-item"><span className="story-context-symbol">MAD</span><div><h3>Vos montants en dirhams</h3><p>Des factures et des règlements adaptés à votre activité.</p></div></div>
            <div className="story-context-item"><span className="story-context-symbol">%</span><div><h3>Votre TVA, clairement détaillée</h3><p>Configurez les taux de vos opérations et retrouvez le HT, la TVA et le TTC.</p></div></div>
            <div className="story-context-item"><span className="story-context-symbol">ICE</span><div><h3>Votre identité sur chaque facture</h3><p>Votre logo, vos coordonnées et vos identifiants d’entreprise sur vos PDF.</p></div></div>
            <div className="story-context-item"><span className="story-context-symbol"><Globe2 size={23} aria-hidden="true" /></span><div><h3>Votre bureau vous suit</h3><p>Un navigateur suffit, sur ordinateur, tablette ou téléphone.</p></div></div>
          </div>
        </div>
      </section>

      <section id="resources" className="story-faq-section" aria-labelledby="story-faq-title">
        <div className="marketing-container story-faq-grid">
          <div data-reveal>
            <p className="marketing-eyebrow">AVANT DE VOUS LANCER</p>
            <h2 id="story-faq-title" className="marketing-section-title">Questions sur le logiciel<br />de gestion et l’ERP.</h2>
            <p className="marketing-copy story-faq-intro">Quelques réponses pour faire vos premiers pas avec Felexia.</p>
            <a href="#contact" className="story-faq-contact">Une autre question ? Parlons-en<ArrowUpRight size={17} aria-hidden="true" /></a>
          </div>
          <div className="story-faq-list" data-reveal>
            {questions.map((item) => (
              <details key={item.question} className="story-faq-item">
                <summary>{item.question}<Plus className="story-faq-plus" size={19} aria-hidden="true" /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
