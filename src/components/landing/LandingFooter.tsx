import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

const productLinks = [
  { label: "Au quotidien", href: "/#modules" }, { label: "Fonctionnalités", href: "/#features" },
  { label: "Tarifs", href: "/#pricing" }, { label: "Questions fréquentes", href: "/#resources" },
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
          <div className="conversion-footer-brand"><Link href="/" aria-label="FelexiaERP — accueil"><BrandLogo size="sm" /></Link><p>L’esprit libre.<br />L’essentiel de votre entreprise, réuni.</p><span>Pensé pour les PME marocaines.</span></div>
          <nav aria-label="Découvrir Felexia"><h2>Découvrir</h2><ul>{productLinks.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul></nav>
          <nav aria-label="Votre espace"><h2>Votre espace</h2><ul>{accessLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>
          <nav aria-label="Informations légales"><h2>En toute clarté</h2><ul>{legalLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>
        </div>
        <p className="conversion-footer-disclaimer">Les fonctions fiscales, sociales et comptables de Felexia sont préparatoires : elles ne se substituent ni à l’expertise d’un professionnel (expert-comptable, conseiller fiscal) ni aux obligations déclaratives applicables au Maroc.</p>
        <div className="conversion-footer-bottom"><p>© {new Date().getFullYear()} Felexia Conseils. FelexiaERP — Tous droits réservés.</p><a href="#top">Retour en haut <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </div>
    </footer>
  );
}
