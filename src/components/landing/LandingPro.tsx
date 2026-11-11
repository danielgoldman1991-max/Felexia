import { ProGuideCta } from "@/components/marketing/ProGuideCta";
import { getProQuoteHref, getProWhatsAppHref } from "@/lib/subscriptions/quote-contact";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, Check, PackageCheck, ShoppingCart, UsersRound } from "lucide-react";
import "./landing-pro.css";

const benefits = [
  { icon: ShoppingCart, title: "Les devis, dès le premier échange.", description: "Devis, commandes et livraisons : le cycle commercial complet est dans PRO, pas dans ESSENTIEL." },
  { icon: Boxes, title: "Le stock et les chiffres se répondent.", description: "Retrouvez vos mouvements, vos emplacements et le détail de votre comptabilité." },
  { icon: UsersRound, title: "Une équipe. Une vue d’ensemble.", description: "Réunissez vos dossiers RH, vos prévisions de trésorerie et vos indicateurs." },
];

export function LandingPro() {
  return (
    <section id="pro" className="pro-suite" aria-labelledby="pro-title">
      <div className="marketing-container">
        <div className="pro-suite-heading" data-reveal>
          <p className="pro-suite-eyebrow">QUAND VOUS GRANDISSEZ</p>
          <h2 id="pro-title">Stock, devis, équipe :<br />tout votre ERP, relié.</h2>
          <p className="pro-suite-intro">Tout ESSENTIEL, plus les devis, les commandes, le stock et la comptabilité étendue, jusqu’à 25 utilisateurs.</p>
        </div>
        <div className="pro-suite-grid">
          <div className="pro-suite-copy" data-reveal>
            <div className="pro-suite-benefits">
              {benefits.map(({ icon: Icon, title, description }) => (
                <article key={title}>
                  <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
                  <div><h3>{title}</h3><p>{description}</p></div>
                </article>
              ))}
            </div>
            <a href={getProQuoteHref()} className="pro-suite-quote">Demander un devis PRO <ArrowUpRight size={17} aria-hidden="true" /></a>
            <a className="pro-suite-whatsapp" href={getProWhatsAppHref()} target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a>
          </div>

          <details className="pro-suite-more">
            <summary>Voir le parcours et le guide PRO</summary>
          <figure className="pro-suite-product">
            <div className="pro-suite-example" aria-hidden="true">
              <div className="pro-suite-appbar"><span className="pro-suite-appmark">f.</span><span>Felexia PRO</span><span className="pro-suite-example-label">Vue d’exemple</span></div>
              <div className="pro-suite-product-heading"><span>VOTRE CYCLE D’ACHAT</span><strong>Du fournisseur à votre stock.</strong></div>
              <div className="pro-suite-flow">
                <div><span className="pro-suite-flow-icon"><ShoppingCart size={19} strokeWidth={1.7} /></span><span><small>01 · COMMANDER</small><strong>Achat préparé</strong></span><Check size={13} /></div>
                <div><span className="pro-suite-flow-icon"><PackageCheck size={19} strokeWidth={1.7} /></span><span><small>02 · RÉCEPTIONNER</small><strong>Marchandise reçue</strong></span><Check size={13} /></div>
                <div><span className="pro-suite-flow-icon"><Boxes size={19} strokeWidth={1.7} /></span><span><small>03 · RETROUVER</small><strong>Stock disponible</strong></span><Check size={13} /></div>
              </div>
              <div className="pro-suite-stock">
                <div className="pro-suite-stock-heading"><strong>Votre stock</strong><span>Emplacement principal</span></div>
                <div className="pro-suite-stock-columns"><span>ARTICLE</span><span>ENTRÉES</span><span>SORTIES</span><span>DISPONIBLE</span></div>
                <div className="pro-suite-stock-row"><span><i>A</i><span>Article A<small>EX-001</small></span></span><span>24</span><span>8</span><strong>16</strong></div>
                <div className="pro-suite-stock-row"><span><i>B</i><span>Article B<small>EX-002</small></span></span><span>18</span><span>6</span><strong>12</strong></div>
                <div className="pro-suite-stock-row"><span><i>C</i><span>Article C<small>EX-003</small></span></span><span>12</span><span>3</span><strong>9</strong></div>
              </div>
              <div className="pro-suite-product-footer"><span>Achats</span><ArrowRight size={14} /><span>Réceptions</span><ArrowRight size={14} /><span>Stock</span></div>
            </div>
            <figcaption>Exemple de parcours PRO · Articles et quantités fictifs.</figcaption>
          </figure>
        <div className="pro-suite-footnote">
          <p>Un projet sur devis, jusqu’à 25 utilisateurs. Le périmètre se construit avec notre équipe.</p>
          <Link href="/pro" className="pro-suite-link">Explorer l’ERP complet <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="pro-suite-guide"><ProGuideCta /></div>
          </details>
        </div>
      </div>
    </section>
  );
}
