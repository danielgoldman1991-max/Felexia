import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AnalyticsSettingsButton } from "@/components/analytics/PublicAnalytics";
import { NewsletterBand } from "@/components/newsletter/NewsletterForm";

const productLinks = [
  { label: "La gestion avec ESSENTIEL", href: "/essentiel" },
  { label: "Au quotidien", href: "/#modules" }, { label: "L’ERP complet PRO", href: "/pro" },
  { label: "Logiciel de facturation", href: "/logiciel-facturation-maroc" },
  { label: "Facture électronique", href: "/facturation-electronique-maroc" },
  { label: "Guides", href: "/guides" },
  { label: "Articles", href: "/blog" },
  { label: "Tarifs", href: "/pricing" }, { label: "FAQ", href: "/#resources" },
];
// TODO(owner): add the official LinkedIn and Facebook URLs next to Instagram. Do not invent profiles.
const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/felexiaerp/" },
];
const accessLinks = [
  { label: "Se connecter", href: "/login" }, { label: "Créer mon espace", href: "/login?mode=register" }, { label: "Nous contacter", href: "/#contact" },
];
const legalLinks = [
  { label: "Mentions légales", href: "/mentions-legales" }, { label: "Confidentialité", href: "/confidentialite" }, { label: "Conditions générales", href: "/conditions" },
];

export function LandingFooter() {
  return (
    <footer className="conversion-footer">
      <div className="marketing-container">
        <div className="conversion-footer-grid">
          <div className="conversion-footer-brand"><Link href="/" aria-label="FelexiaERP — accueil"><BrandLogo size="sm" /></Link><p>Logiciel de gestion pour les PME au Maroc.<br />ESSENTIEL au quotidien, PRO sur devis.</p><span>Pensé pour les PME marocaines.</span><ul className="conversion-footer-social">{socialLinks.map((link) => <li key={link.href}><a href={link.href} target="_blank" rel="me noopener noreferrer">{link.label}<span className="conversion-footer-external"> (nouvel onglet)</span></a></li>)}</ul></div>
          <nav aria-label="Découvrir Felexia"><h2>Découvrir</h2><ul>{productLinks.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul></nav>
          <nav aria-label="Votre espace"><h2>Votre espace</h2><ul>{accessLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>
          <nav aria-label="Informations légales"><h2>En toute clarté</h2><ul>{legalLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}<li><AnalyticsSettingsButton /></li></ul></nav>
        </div>
        <NewsletterBand source="footer" />
        <p className="conversion-footer-disclaimer">Les fonctions fiscales, sociales et comptables de Felexia sont préparatoires : elles ne se substituent ni à l’expertise d’un professionnel (expert-comptable, conseiller fiscal) ni aux obligations déclaratives applicables au Maroc.</p>
        <div className="conversion-footer-bottom"><p>© {new Date().getFullYear()} Felexia Conseils. FelexiaERP — Tous droits réservés.</p><a href="#top">Retour en haut <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </div>
    </footer>
  );
}
