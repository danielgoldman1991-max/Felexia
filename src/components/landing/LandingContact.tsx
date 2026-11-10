import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import styles from "./landing-contact.module.css";

export function LandingContact() {
  const email = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
  return (
    <section id="contact" aria-labelledby="conversion-contact-title" className={styles.section}>
      <div className="marketing-container">
        <div className={styles.heading} data-reveal>
          <div>
            <p className={styles.eyebrow}>ET MAINTENANT ?</p>
            <h2 id="conversion-contact-title">Votre prochain cap<br />commence ici.</h2>
          </div>
          <p className={styles.intro}>Commencez avec ESSENTIEL ou construisons votre projet PRO.</p>
        </div>

        <div className={styles.paths}>
          <article className={styles.path} data-reveal>
            <span className={styles.pathLabel}>01 / POUR COMMENCER</span>
            <h3>Essayez ESSENTIEL.</h3>
            <p>Vos factures, vos achats et votre trésorerie. Un espace pour prendre votre gestion en main.</p>
            <Link href="/login?mode=register" className={styles.primary}>Créer mon espace <ArrowRight size={18} aria-hidden="true" /></Link>
            <span className={styles.note}>{DEFAULT_TRIAL_DURATION_LABEL} d’essai · Sans carte bancaire</span>
          </article>
          <article className={styles.path} data-reveal>
            <span className={styles.pathLabel}>02 / POUR ALLER PLUS LOIN</span>
            <h3>Parlons de votre ERP.</h3>
            <p>Un projet plus large ? Définissons ensemble les fonctions utiles à votre entreprise.</p>
            <a href={getProQuoteHref()} className={styles.secondary}>Demander un devis PRO <ArrowUpRight size={18} aria-hidden="true" /></a>
            <span className={styles.note}>PRO sur devis · Mise en place accompagnée</span>
          </article>
        </div>

        <div className={styles.contact} data-reveal>
          <p><Mail size={18} aria-hidden="true" /><span>Une question ? Échangeons sur votre activité.</span></p>
          <a href={`mailto:${email}?subject=${encodeURIComponent("Felexia — offres ESSENTIEL et PRO")}`}>{email}<ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
