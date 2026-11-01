import Link from "next/link";
import { ArrowRight, ArrowUpRight, Archive, Building2, Check, FileCheck2, FileCode2, FileText, History } from "lucide-react";
import "./landing-einvoicing.css";

const benefits = [
  {
    number: "01",
    icon: FileCheck2,
    title: "Partez de vos documents existants.",
    description: "Retrouvez vos factures et avoirs clients déjà validés. Leur numéro et leurs montants restent les mêmes.",
  },
  {
    number: "02",
    icon: FileCode2,
    title: "Un PDF et un XML, sous contrôle.",
    description: "Générez les deux formats après les contrôles, puis vérifiez vos informations avant l’émission.",
  },
  {
    number: "03",
    icon: History,
    title: "Émettez. Archivez. Retrouvez.",
    description: "L’émission fige et archive votre version en une seule opération. Téléchargez vos fichiers et retrouvez leur historique.",
  },
];

export function LandingEinvoicing() {
  return (
    <section id="facturation-electronique" className="einvoice-section" aria-labelledby="einvoice-title">
      <div className="marketing-container">
        <div className="einvoice-heading" data-reveal>
          <p className="marketing-eyebrow einvoice-eyebrow">FACTURATION ÉLECTRONIQUE</p>
          <h2 id="einvoice-title" className="marketing-section-title einvoice-title">La facture électronique.<br /><span>Un parcours simplifié.</span></h2>
          <p className="einvoice-intro">De vos factures validées à leurs archives, gardez la main sur chaque étape. Vos PDF, vos XML et leur historique se retrouvent dans Felexia.</p>
        </div>

        <div className="einvoice-grid">
          <div className="einvoice-content" data-reveal>
            <ol className="einvoice-benefits">
              {benefits.map((benefit) => (
                <li key={benefit.number}>
                  <span className="einvoice-benefit-number" aria-hidden="true">{benefit.number}</span>
                  <div><h3><benefit.icon size={17} aria-hidden="true" />{benefit.title}</h3><p>{benefit.description}</p></div>
                </li>
              ))}
            </ol>
            <div className="einvoice-actions">
              <Link href="/login?mode=register" className="marketing-button einvoice-start">Démarrer gratuitement<ArrowUpRight size={17} aria-hidden="true" /></Link>
              <Link href="/facturation/electronique" className="einvoice-existing">Déjà client ? Ouvrir le module<ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <p className="einvoice-activation">Votre administrateur active le module pour votre entreprise, depuis Ventes → Facturation électronique.</p>
          </div>

          <figure className="einvoice-scene" data-reveal aria-label="Votre facture et ses deux formats, PDF et XML, réunis dans une archive" aria-describedby="einvoice-scene-description">
            <figcaption id="einvoice-scene-description" hidden>Représentation d’un parcours documentaire avec des informations génériques : préparation, génération des fichiers, vérification, puis émission et archivage.</figcaption>
            <div className="einvoice-scene-interior" aria-hidden="true">
              <div className="einvoice-scene-top"><span className="einvoice-scene-mark"><FileCheck2 size={16} /></span><span>Votre espace documentaire</span><span className="einvoice-scene-status-dot" /></div>

              <div className="einvoice-paper">
                <div className="einvoice-paper-top"><span className="einvoice-company-mark"><Building2 size={20} /></span><span>FACTURE<b>Votre document</b></span></div>
                <strong className="einvoice-company-name">Votre entreprise</strong>
                <span className="einvoice-company-info">Vos coordonnées · Votre ICE</span>
                <div className="einvoice-paper-recipient"><span>FACTURÉ À</span><b>Votre client</b><i /><i /></div>
                <div className="einvoice-paper-table"><span>Produits et prestations</span><span>Montants</span></div>
                <div className="einvoice-paper-row"><i /><i /></div>
                <div className="einvoice-paper-row"><i /><i /></div>
                <div className="einvoice-paper-totals"><span>HT <i /></span><span>TVA <i /></span><span>TOTAL TTC <i /></span></div>
                <div className="einvoice-paper-seal"><Check size={10} />Version figée après émission</div>
              </div>

              <div className="einvoice-artifact einvoice-artifact-pdf"><span className="einvoice-artifact-icon"><FileText size={25} strokeWidth={1.4} /></span><span><b>PDF</b><small>Votre facture à partager</small></span><span className="einvoice-artifact-check"><Check size={12} /></span></div>
              <div className="einvoice-artifact einvoice-artifact-xml"><span className="einvoice-artifact-icon"><FileCode2 size={25} strokeWidth={1.4} /></span><span><b>XML</b><small>Vos données structurées</small></span><span className="einvoice-artifact-check"><Check size={12} /></span></div>
              <div className="einvoice-archive"><span className="einvoice-archive-icon"><Archive size={21} strokeWidth={1.5} /></span><span><strong>Émise et archivée</strong><small>Vos fichiers. La même version.</small></span><span className="einvoice-archive-check"><Check size={13} /></span></div>
              <div className="einvoice-scene-baseline"><span>Préparer</span><i /><span>Vérifier</span><i /><span>Émettre & archiver</span></div>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
