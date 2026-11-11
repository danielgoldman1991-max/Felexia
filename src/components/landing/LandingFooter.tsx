import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AnalyticsSettingsButton } from "@/components/analytics/PublicAnalytics";
import { NewsletterBand } from "@/components/newsletter/NewsletterForm";
import styles from "./public-footer.module.css";

const discoverLinks = [
  { label: "La gestion avec ESSENTIEL", href: "/essentiel" },
  { label: "Au quotidien", href: "/#modules" },
  { label: "L’ERP complet PRO", href: "/pro" },
  { label: "Logiciel de facturation", href: "/logiciel-facturation-maroc" },
  { label: "Facture électronique", href: "/facturation-electronique-maroc" },
];
const resourceLinks = [
  { label: "Guides", href: "/guides" },
  { label: "Articles", href: "/blog" },
  { label: "Tarifs", href: "/pricing" },
  { label: "FAQ", href: "/#resources" },
];
const accessLinks = [
  { label: "Se connecter", href: "/login" },
  { label: "Essayer gratuitement", href: "/login?mode=register" },
  { label: "Nous contacter", href: "/#contact" },
];
const legalLinks = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Conditions générales", href: "/conditions" },
];
type SocialLink = { label: string; href: string; icon: "instagram" | "linkedin"; ariaLabel?: string };
// TODO(owner): add the official Facebook URL next to Instagram and LinkedIn. Do not invent a profile.
const socialLinks: SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/felexiaerp/", icon: "instagram" as const },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/felexiaerp/",
    icon: "linkedin" as const,
    ariaLabel: "FelexiaERP sur LinkedIn (nouvel onglet)",
  },
];

const columns = [
  { title: "Découvrir", label: "Découvrir Felexia", links: discoverLinks },
  { title: "Ressources", label: "Ressources", links: resourceLinks },
  { title: "Votre espace", label: "Votre espace", links: accessLinks },
  { title: "Légal", label: "Informations légales", links: legalLinks, cookies: true },
];

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <Link href="/" aria-label="FelexiaERP — accueil"><BrandLogo size="sm" /></Link>
            <p className={styles.tagline}>Logiciel de gestion pour les PME au Maroc. ESSENTIEL au quotidien, PRO sur devis.</p>
            <p className={styles.note}>Pensé pour les PME marocaines.</p>
            <ul className={styles.social}>
              {socialLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel={link.icon === "linkedin" ? "noopener noreferrer" : "me noopener noreferrer"} aria-label={link.ariaLabel}>
                    {link.icon === "linkedin" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.22 8.5h4.56V24H.22V8.5zM8.34 8.5h4.37v2.12h.06c.61-1.16 2.1-2.38 4.32-2.38 4.62 0 5.48 3.04 5.48 7V24h-4.56v-6.86c0-1.64-.03-3.74-2.28-3.74-2.28 0-2.63 1.78-2.63 3.62V24H8.34V8.5z" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" /></svg>
                    )}
                    {link.label}
                    {link.ariaLabel ? null : <span className={styles.srOnly}> (nouvel onglet)</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {columns.map((column) => (
            <nav key={column.title} className={styles.column} aria-label={column.label}>
              <h2>{column.title}</h2>
              <ul className={styles.links}>
                {column.links.map((link) => (
                  <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                ))}
                {column.cookies ? <li><AnalyticsSettingsButton className={styles.linkButton} /></li> : null}
              </ul>
            </nav>
          ))}
        </div>
        <div className={styles.newsletter}>
          <NewsletterBand source="footer" />
        </div>
        <p className={styles.disclaimer}>Les fonctions fiscales, sociales et comptables de Felexia sont préparatoires : elles ne se substituent ni à l’expertise d’un professionnel (expert-comptable, conseiller fiscal) ni aux obligations déclaratives applicables au Maroc.</p>
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} Felexia Conseils. FelexiaERP — Tous droits réservés.</p>
          <a className={styles.top} href="#top">Retour en haut <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
