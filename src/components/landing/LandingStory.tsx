import Link from "next/link";
import { ArrowUpRight, Globe2, Plus } from "lucide-react";
import { getProWhatsAppHref } from "@/lib/subscriptions/quote-contact";
import { HOME_FAQS } from "@/lib/content/public-faq";
import styles from "./landing-story.module.css";

const localDetails = [
  { mark: "MAD", title: "Les bons montants.", copy: "Vos factures et vos règlements en dirhams." },
  { mark: "TVA", title: "Des chiffres lisibles.", copy: "Le HT, les taux et la TVA clairement détaillés." },
  { mark: "ICE", title: "ICE, IF et RC.", copy: "Ils figurent sur la facture lorsque vous les avez renseignés." },
];

export function LandingLocalContext() {
  return (
    <section id="why" className={styles.local} aria-labelledby="story-context-title">
      <div className={`marketing-container ${styles.localGrid}`}>
        <div className={styles.localIntro} data-reveal>
          <p className="marketing-eyebrow">FAIT POUR LE MAROC</p>
          <h2 id="story-context-title" className="marketing-section-title">Fait pour les règles d’ici.</h2>
          <p className={styles.description}>Felexia parle MAD, TVA et ICE dès le premier jour. Votre espace s’ouvre dans le navigateur, au bureau comme en déplacement.</p>
          <Link href="/logiciel-facturation-maroc" className={styles.textLink}>La facturation avec Felexia <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className={styles.localDetails} data-reveal>
          <div className={styles.localTopline}><Globe2 size={17} aria-hidden="true" /><span>UNE GESTION QUI PARLE VOTRE LANGUE</span></div>
          {localDetails.map((item) => (
            <div className={styles.localRow} key={item.mark}>
              <span className={styles.localMark} aria-hidden="true">{item.mark}</span>
              <div><h3>{item.title}</h3><p>{item.copy}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingStory() {
  return (
    <section id="resources" className={styles.faq} aria-labelledby="story-faq-title">
      <div className={`marketing-container ${styles.faqGrid}`}>
        <div className={styles.faqIntro} data-reveal>
          <p className="marketing-eyebrow">QUESTIONS FRÉQUENTES</p>
          <h2 id="story-faq-title" className="marketing-section-title">Les questions qu’on nous pose avant de commencer.</h2>
          <p className={styles.description}>Facturation, données, essai et passage à PRO.</p>
          <a href={getProWhatsAppHref("Bonjour, j’ai une question avant de commencer avec Felexia.")} className={styles.textLink} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <div className={styles.faqList} data-reveal>
          {HOME_FAQS.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>{item.question}<Plus className={styles.faqPlus} size={18} aria-hidden="true" /></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
