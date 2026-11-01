import Link from "next/link";
import { ArrowUpRight, BookOpen, FileCheck2, FileText, Landmark, ShoppingBag } from "lucide-react";
import "./landing-essentiel.css";

const activities = [
  { icon: FileText, title: "Ventes et facturation", description: "Retrouvez vos clients, préparez vos factures et avoirs, puis suivez les règlements et les montants à encaisser." },
  { icon: ShoppingBag, title: "Achats et fournisseurs", description: "Centralisez vos fournisseurs, leurs factures et leurs avoirs. Gardez une vue claire sur les montants à payer et les règlements effectués." },
  { icon: Landmark, title: "Banque, caisse et trésorerie", description: "Suivez vos encaissements, vos paiements et les mouvements de vos comptes bancaires et caisses." },
  { icon: BookOpen, title: "Journaux et suivi d’activité", description: "Consultez vos journaux de vente, d’achat, de banque et de caisse. Retrouvez vos indicateurs et exportez vos données." },
];

export function LandingEssentiel() {
  return (
    <section id="essentiel" className="essentiel-section" aria-labelledby="essentiel-title">
      <div className="marketing-container">
        <div className="essentiel-heading" data-reveal>
          <p className="marketing-eyebrow">ESSENTIEL · GESTION D’ENTREPRISE</p>
          <h2 id="essentiel-title" className="marketing-section-title">Toute votre gestion.<br />Au même endroit.</h2>
          <p>Ventes, achats, clients, fournisseurs et trésorerie : ESSENTIEL rassemble les outils pour gérer votre entreprise au quotidien.</p>
        </div>
        <div className="essentiel-activities">
          {activities.map((activity) => (
            <article key={activity.title} data-reveal>
              <span className="essentiel-activity-icon"><activity.icon size={23} aria-hidden="true" /></span>
              <h3>{activity.title}</h3>
              <p>{activity.description}</p>
            </article>
          ))}
        </div>
        <div id="facturation-electronique" className="essentiel-einvoice" data-reveal>
          <FileCheck2 size={25} aria-hidden="true" />
          <div><h3>Compatible avec la facturation électronique</h3><p>La génération PDF/XML, l’émission et l’archivage de vos factures sont inclus dans ESSENTIEL et PRO.</p></div>
        </div>
        <div className="essentiel-actions" data-reveal>
          <Link href="/login?mode=register" className="marketing-button marketing-button-primary">Essayer ESSENTIEL gratuitement<ArrowUpRight size={17} aria-hidden="true" /></Link>
          <Link href="/essentiel">Découvrir les fonctions ESSENTIEL<ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
