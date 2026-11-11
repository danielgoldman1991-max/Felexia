import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { getProQuoteHref, getProWhatsAppHref } from "@/lib/subscriptions/quote-contact";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import styles from "./landing-contact.module.css";

export function LandingContact() {
  const email = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
  return (
    <section id="contact" aria-labelledby="conversion-contact-title" className={styles.section}>
      <div className="marketing-container">
        <div className={styles.heading} data-reveal>
          <div>
            <p className={styles.eyebrow}>POUR COMMENCER</p>
            <h2 id="conversion-contact-title">Votre première facture conforme vous attend.</h2>
          </div>
          <p className={styles.intro}>Commencez avec ESSENTIEL ou construisons votre projet PRO.</p>
        </div>

        <div className={styles.paths}>
          <article className={styles.path} data-reveal>
            <span className={styles.pathLabel}>ESSAI</span>
            <h3>Facturez avec ESSENTIEL.</h3>
            <p>Factures, règlements et journaux. Les devis arrivent avec PRO.</p>
            <Link href="/login?mode=register" className={styles.primary}>Essayer gratuitement <ArrowRight size={18} aria-hidden="true" /></Link>
            <span className={styles.note}>{DEFAULT_TRIAL_DURATION_LABEL} · sans carte bancaire</span>
          </article>
          <article className={styles.path} data-reveal>
            <span className={styles.pathLabel}>PRO</span>
            <h3>Passez aux devis et à l’ERP.</h3>
            <p>Devis, commandes, stock et équipe : une proposition, pas un prix en ligne.</p>
            <a href={getProQuoteHref()} className={styles.secondary}>Demander un devis PRO <ArrowUpRight size={18} aria-hidden="true" /></a>
            <a className={styles.whatsapp} href={getProWhatsAppHref()} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a>
          </article>
        </div>

        <div className={styles.contact} data-reveal>
          <p><Mail size={18} aria-hidden="true" /><span>Une question ? Écrivez-nous, ou passez par WhatsApp.</span></p>
          <a href={getProWhatsAppHref("Bonjour, j’ai une question sur Felexia.")} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp<ArrowUpRight size={16} aria-hidden="true" /></a>
          <a href={`mailto:${email}?subject=${encodeURIComponent("Felexia — offres ESSENTIEL et PRO")}`}>{email}<ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
