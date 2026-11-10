import { ProGuideCta } from "@/components/marketing/ProGuideCta";
import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, Check, PackageCheck, ShoppingCart, UsersRound } from "lucide-react";
import "./landing-pro.css";

const benefits = [
  { icon: ShoppingCart, title: "Du devis à la livraison.", description: "Commandes clients, achats et réceptions : gardez le fil de vos opérations." },
  { icon: Boxes, title: "Le stock et les chiffres se répondent.", description: "Retrouvez vos mouvements, vos emplacements et le détail de votre comptabilité." },
  { icon: UsersRound, title: "Une équipe. Une vue d’ensemble.", description: "Réunissez vos dossiers RH, vos prévisions de trésorerie et vos indicateurs." },
];

export function LandingPro() {
  return (
    <section id="pro" className="pro-suite" aria-labelledby="pro-title">
      <div className="marketing-container">
        <div className="pro-suite-heading" data-reveal>
          <p className="pro-suite-eyebrow">FELEXIA PRO · L’ERP COMPLET</p>
          <h2 id="pro-title">Quand votre entreprise grandit,<br />votre outil suit.</h2>
          <p className="pro-suite-intro">Tout ESSENTIEL, avec un ERP qui relie vos ventes, vos achats, votre stock et votre équipe.</p>
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
            <Link href="/pro" className="pro-suite-link">Explorer l’ERP complet <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>

          <figure className="pro-suite-product" data-reveal>
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
        </div>

        <div className="pro-suite-footnote" data-reveal>
          <p>Un projet sur devis, jusqu’à 25 utilisateurs. Le périmètre se construit avec notre équipe.</p>
          <Link href="/blog/gestion-de-stock-au-maroc">Comprendre la gestion de stock <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="pro-suite-guide"><ProGuideCta /></div>
        <p className="pro-suite-scope">Les fonctions précisées au devis définissent le périmètre disponible. Les écrans « à venir » sont exclus. Les déclarations TVA et la paie restent préparatoires, à valider avec vos conseils.</p>
      </div>
    </section>
  );
}
