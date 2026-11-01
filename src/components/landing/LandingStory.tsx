import Link from "next/link";
import { ArrowUpRight, Globe2, Plus } from "lucide-react";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import { LandingJourney } from "./LandingJourney";
import "./landing-story.css";

const questions = [
  {
    question: "Que permet la facturation électronique ?",
    answer:
      "À partir de vos factures et avoirs clients validés, générez un PDF lisible et un XML structuré. Vérifiez les documents, puis émettez et archivez la version retenue. Retrouvez ensuite vos fichiers et leur historique dans votre espace.",
  },
  {
    question: "Comment activer la facturation électronique ?",
    answer:
      "Votre administrateur active le module dans Ventes → Facturation électronique → Configuration et complète les informations de l’entreprise. Un essai ou abonnement valide est nécessaire pour préparer et émettre de nouveaux documents.",
  },
  {
    question: "Les factures sont-elles transmises à la DGI ?",
    answer:
      "Le parcours actuel couvre les documents PDF/XML et leur archivage. La connexion officielle à la DGI et la signature qualifiée ne sont pas activées. Le XML généré ne constitue pas une acceptation fiscale.",
  },
  {
    question: "Comment fonctionne l’essai gratuit ?",
    answer: `Créez votre compte et votre espace entreprise pour découvrir l’offre Essentiel pendant ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. Vous retrouvez ensuite les tarifs mensuels et annuels ci-dessous.`,
  },
  {
    question: "Que comprend l’offre Essentiel ?",
    answer:
      "La facturation électronique PDF/XML et l’archivage, vos clients et fournisseurs, les factures de vente et d’achat, les règlements, les comptes bancaires et caisses, la trésorerie et les journaux. Vous pouvez travailler jusqu’à 3 utilisateurs dans votre espace entreprise.",
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
      <LandingJourney />

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
