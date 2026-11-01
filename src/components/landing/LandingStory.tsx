import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  FileText,
  Globe2,
  Landmark,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import "./landing-story.css";

const questions = [
  {
    question: "Comment fonctionne l’essai gratuit ?",
    answer: `Créez votre compte et votre espace entreprise pour découvrir l’offre Essentiel pendant ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. Vous retrouvez ensuite les tarifs mensuels et annuels ci-dessous.`,
  },
  {
    question: "Que comprend l’offre Essentiel ?",
    answer:
      "Vos clients et fournisseurs, les factures de vente et d’achat, les règlements, les comptes bancaires et caisses, la trésorerie et les journaux. Vous pouvez travailler jusqu’à 3 utilisateurs dans votre espace entreprise.",
  },
  {
    question: "Puis-je personnaliser mes factures ?",
    answer:
      "Oui. Ajoutez votre logo, les coordonnées et l’ICE de votre entreprise. Configurez vos informations et votre numérotation pour retrouver votre identité sur les factures PDF.",
  },
  {
    question: "Felexia fonctionne-t-il sur mobile ?",
    answer:
      "Oui. Votre espace est accessible dans votre navigateur sur ordinateur, tablette et téléphone. Vous pouvez retrouver vos factures, vos règlements et votre trésorerie depuis ces appareils.",
  },
  {
    question: "Et si mon entreprise a besoin d’autres modules ?",
    answer:
      "Les modules complémentaires, comme le stock ou la comptabilité avancée, sont accessibles sur demande. Contactez notre équipe pour préciser votre activité et échanger sur vos besoins.",
  },
];

export function LandingStory() {
  return (
    <>
      <section id="modules" className="story-product-section" aria-labelledby="story-product-title">
        <div className="marketing-container">
          <div className="story-heading-row" data-reveal>
            <div>
              <p className="marketing-eyebrow">MOINS DE DISPERSION. PLUS DE CLARTÉ.</p>
              <h2 id="story-product-title" className="marketing-section-title">
                Toute votre activité.<br />Un seul fil conducteur.
              </h2>
            </div>
            <p className="marketing-copy story-heading-copy">
              De votre première facture au dernier règlement, chaque opération trouve sa place.
              Et vous, vous gardez la vue d’ensemble.
            </p>
          </div>

          <div className="story-bento" id="features">
            <article className="story-card story-sales" data-reveal>
              <div className="story-card-heading">
                <span className="story-module-icon"><FileText size={20} aria-hidden="true" /></span>
                <span className="story-card-index">01 / VENTES</span>
              </div>
              <h3>Des factures à votre image.</h3>
              <p>Vos clients, vos factures PDF personnalisées et les montants à encaisser, au même endroit.</p>
              <div className="story-invoice-scene" aria-hidden="true">
                <div className="story-invoice-paper">
                  <div className="story-paper-top"><span className="story-paper-monogram">F.</span><span>FACTURE<br /><b>FAC-001</b></span></div>
                  <div className="story-paper-rule" />
                  <div className="story-paper-party"><span>Votre entreprise</span><span>Votre client</span></div>
                  <div className="story-paper-line"><span>Prestation de services</span><span>1 000,00</span></div>
                  <div className="story-paper-line"><span>TVA</span><span>200,00</span></div>
                  <div className="story-paper-total"><span>Total TTC</span><strong>1 200,00 <small>MAD</small></strong></div>
                </div>
                <div className="story-paid-stamp"><CheckCheck size={17} />Règlement enregistré</div>
              </div>
            </article>

            <article className="story-card story-treasury" data-reveal>
              <div className="story-card-heading">
                <span className="story-module-icon"><Landmark size={20} aria-hidden="true" /></span>
                <span className="story-card-index">02 / TRÉSORERIE</span>
              </div>
              <h3>Votre argent, en perspective.</h3>
              <p>Comptes bancaires, caisses, entrées et sorties : retrouvez vos mouvements et vos soldes.</p>
              <div className="story-cash-visual" aria-hidden="true">
                <div className="story-cash-caption"><span>Une vision claire des mouvements</span><Landmark size={16} /></div>
                <div className="story-cash-bars">
                  {[42, 62, 48, 76, 66, 91, 79, 100, 88, 116, 105, 134].map((height, index) => (
                    <span key={index} style={{ height }}><i /></span>
                  ))}
                </div>
                <div className="story-cash-legend"><span><i />Encaissements</span><span><i />Décaissements</span></div>
              </div>
            </article>

            <article className="story-card story-purchases" data-reveal>
              <div className="story-card-heading">
                <span className="story-module-icon"><ShoppingBag size={20} aria-hidden="true" /></span>
                <span className="story-card-index">03 / ACHATS</span>
              </div>
              <h3>Les bons repères pour payer.</h3>
              <p>Centralisez vos fournisseurs, saisissez leurs factures et suivez les règlements à effectuer.</p>
              <div className="story-purchase-list" aria-hidden="true">
                <div><span className="story-supplier-avatar">A</span><span><b>Fournisseur Atelier</b><small>Facture d’achat</small></span><span className="story-status story-status-pending">À régler</span></div>
                <div><span className="story-supplier-avatar">S</span><span><b>Fournisseur Studio</b><small>Règlement fournisseur</small></span><span className="story-status story-status-paid"><Check size={12} />Réglée</span></div>
              </div>
            </article>

            <article className="story-card story-journals" data-reveal>
              <div className="story-card-heading">
                <span className="story-module-icon"><BookOpen size={20} aria-hidden="true" /></span>
                <span className="story-card-index">04 / JOURNAUX</span>
              </div>
              <h3>Chaque mouvement a une histoire.</h3>
              <p>Retrouvez les journaux et les écritures associés à vos ventes, achats et règlements.</p>
              <div className="story-journal-flow" aria-hidden="true">
                <span><FileText size={22} /><b>Facture</b></span>
                <ArrowRight className="story-flow-arrow" size={19} />
                <span><ArrowDownLeft size={22} /><b>Règlement</b></span>
                <ArrowRight className="story-flow-arrow" size={19} />
                <span><BookOpen size={22} /><b>Journal</b></span>
              </div>
            </article>
          </div>
          <p className="story-illustration-note">Aperçus illustratifs · Données fictives</p>
        </div>
      </section>

      <section id="why" className="story-context-section" aria-labelledby="story-context-title">
        <div className="marketing-container story-context-grid">
          <div data-reveal>
            <p className="marketing-eyebrow story-context-eyebrow">VOTRE ENTREPRISE A SON TERRAIN.</p>
            <h2 id="story-context-title" className="marketing-section-title story-context-title">
              Pensé ici.<br />Accessible partout.
            </h2>
            <p className="story-context-copy">Le quotidien d’une PME marocaine mérite des outils qui parlent sa langue. Felexia rassemble vos repères, sans compliquer votre gestion.</p>
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
            <h2 id="story-faq-title" className="marketing-section-title">C’est simple.<br />Et c’est clair.</h2>
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
