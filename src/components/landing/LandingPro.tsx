import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";
import { ArrowUpRight, BookOpen, Boxes, ChartNoAxesCombined, ClipboardList, ShoppingCart, UsersRound } from "lucide-react";
import "./landing-pro.css";

const modules = [
  { icon: ClipboardList, title: "De la relation client à la livraison", description: "Prospects, devis, commandes, livraisons et retours : suivez votre cycle de vente dans le même espace." },
  { icon: ShoppingCart, title: "Des achats reliés au terrain", description: "Préparez vos commandes fournisseurs, réceptionnez les marchandises et retrouvez vos factures et règlements." },
  { icon: Boxes, title: "Une vue sur votre stock", description: "Retrouvez vos emplacements et vos mouvements d’entrée et de sortie pour suivre les articles de votre entreprise." },
  { icon: BookOpen, title: "Vos chiffres, jusqu’au détail", description: "Plan comptable, journaux, grand livre, balance et préparation des déclarations TVA pour travailler avec vos conseils." },
  { icon: ChartNoAxesCombined, title: "Un pilotage plus large", description: "Rapprochement bancaire, prévisions de trésorerie et indicateurs de gestion pour prendre du recul sur votre activité." },
  { icon: UsersRound, title: "Votre équipe dans la boucle", description: "Centralisez les dossiers du personnel et les contrats. Les consultations RH et le calcul de base de paie restent préparatoires." },
];

export function LandingPro() {
  return (
    <section id="pro" className="pro-section" aria-labelledby="pro-title">
      <div className="marketing-container">
        <div className="pro-intro" data-reveal>
          <div>
            <p className="marketing-eyebrow">FELEXIA PRO · L’ERP COMPLET</p>
            <h2 id="pro-title" className="marketing-section-title">Toute votre entreprise.<br />Un même horizon.</h2>
          </div>
          <div className="pro-intro-copy">
            <p className="marketing-copy">Vos ventes ne s’arrêtent pas à la facture. Avec PRO, reliez votre gestion commerciale, vos achats, votre stock, votre comptabilité et vos ressources humaines.</p>
            <a href="#pricing" className="pro-link">Comparer ESSENTIEL et PRO <ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="pro-modules" data-reveal>
          {modules.map(({ icon: Icon, title, description }, index) => (
            <article className="pro-module" key={title}>
              <div className="pro-module-top"><span className="pro-module-icon"><Icon size={23} aria-hidden="true" /></span><span className="pro-module-number" aria-hidden="true">0{index + 1}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <div className="pro-bottom" data-reveal>
          <p><strong>Tout ESSENTIEL est inclus.</strong> Retrouvez vos ventes, vos achats, votre trésorerie et la facturation électronique, avec les fonctions de l’ERP complet et jusqu’à 25 utilisateurs.</p>
          <a href={getProQuoteHref()} className="marketing-button marketing-button-primary">Demander un devis PRO <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
        <p className="pro-scope-note">PRO se met en place avec notre équipe, selon les fonctions précisées au devis. Les écrans « à venir » sont exclus des opérations disponibles. Les déclarations TVA et la paie restent préparatoires, à valider avec vos conseils.</p>
      </div>
    </section>
  );
}
