"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, ChartNoAxesCombined, Check, FileCheck2, FileCode2, FileText, Landmark, ShoppingBag } from "lucide-react";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import styles from "./landing-essentiel-product.module.css";

const tabs = [
  { label: "Facturer", icon: FileText },
  { label: "Suivre les règlements", icon: Landmark },
  { label: "Piloter", icon: ChartNoAxesCombined },
];

const documents = [
  { reference: "FAC-DEMO-001", client: "Client A · Démo", amount: "7 200", status: "Soldée", tone: "settled" },
  { reference: "FAC-DEMO-002", client: "Client B · Démo", amount: "3 600", status: "Partiel", tone: "partial" },
  { reference: "FAC-DEMO-003", client: "Client C · Démo", amount: "1 800", status: "À recevoir", tone: "open" },
];

function InvoicePreview() {
  return (
    <>
      <div className={styles.screenHeading}>
        <div><p className={styles.screenEyebrow}>VENTES / FACTURES CLIENTS</p><h3>Vos documents, bien suivis.</h3></div>
        <span className={styles.period}>Novembre 2026 · Exemple</span>
      </div>
      <div className={styles.invoiceLayout}>
        <div className={styles.invoiceList}>
          <div className={styles.listHeading}><span>Factures clients</span><span>3 documents</span></div>
          <table className={styles.invoiceTable}>
            <caption className={styles.srOnly}>Trois factures fictives et leur état de règlement</caption>
            <colgroup><col className={styles.documentColumn} /><col className={styles.amountColumn} /><col className={styles.statusColumn} /></colgroup>
            <thead><tr><th scope="col">Document</th><th scope="col">Total TTC</th><th scope="col">Règlement</th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.reference}>
                  <td><strong>{document.reference}</strong><span>{document.client}</span></td>
                  <td className={styles.amountCell}><strong>{document.amount}</strong><span>MAD</span></td>
                  <td><span className={`${styles.status} ${styles[document.tone]}`}>{document.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.mobileInvoiceList} aria-label="Factures fictives et règlements">
            {documents.map((document) => (
              <li key={document.reference}>
                <div className={styles.mobileInvoiceHeading}>
                  <strong>{document.reference}</strong>
                  <span className={`${styles.status} ${styles[document.tone]}`}>{document.status}</span>
                </div>
                <p className={styles.mobileInvoiceClient}>{document.client}</p>
                <dl className={styles.mobileInvoiceAmount}>
                  <div><dt>Total TTC</dt><dd><strong>{document.amount}</strong><span>MAD</span></dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className={styles.listSummary}><span>Facturé dans cet exemple</span><strong>12 600 <small>MAD TTC</small></strong></div>
        </div>
        <aside className={styles.documentDetail} aria-label="Détail de la première facture fictive">
          <span className={styles.documentMark}><FileText size={22} aria-hidden="true" /></span>
          <p className={styles.detailEyebrow}>VOTRE FACTURE</p>
          <h4>FAC-DEMO-001</h4>
          <p className={styles.clientName}>Client A · Démonstration</p>
          <div className={styles.documentTotal}><span>Total TTC</span><strong>7 200 <small>MAD</small></strong></div>
          <dl className={styles.taxDetails}><div><dt>Total HT</dt><dd>6 000 MAD</dd></div><div><dt>TVA · 20 %</dt><dd>1 200 MAD</dd></div></dl>
          <div className={styles.documentFormats}><span><FileText size={14} aria-hidden="true" /> PDF</span><span><FileCode2 size={14} aria-hidden="true" /> XML</span></div>
          <p className={styles.archiveNote}><Check size={13} aria-hidden="true" /> Émise et archivée</p>
        </aside>
      </div>
      <p className={styles.screenNote}>Votre identité d’entreprise, vos factures et leur historique au même endroit.</p>
    </>
  );
}

function PaymentsPreview() {
  return (
    <>
      <div className={styles.screenHeading}>
        <div><p className={styles.screenEyebrow}>RÈGLEMENTS / SUIVI CLIENTS</p><h3>Chaque règlement a sa place.</h3></div>
        <span className={styles.period}>Novembre 2026 · Exemple</span>
      </div>
      <div className={styles.paymentsLayout}>
        <div className={styles.receipts}>
          <div className={styles.receiptsTotal}><span>Règlements reçus</span><strong>9 000 <small>MAD</small></strong><p>Deux encaissements reliés à leurs factures.</p></div>
          <div className={styles.receiptRow}><span className={styles.receiptIcon}><ArrowDownLeft size={18} aria-hidden="true" /></span><div><strong>Client A · Démo</strong><span>FAC-DEMO-001 · 03 nov.</span></div><strong>7 200 <small>MAD</small></strong></div>
          <div className={styles.receiptRow}><span className={styles.receiptIcon}><ArrowDownLeft size={18} aria-hidden="true" /></span><div><strong>Client B · Démo</strong><span>FAC-DEMO-002 · 06 nov.</span></div><strong>1 800 <small>MAD</small></strong></div>
        </div>
        <aside className={styles.outstanding} aria-label="Montants fictifs restant à recevoir">
          <span className={styles.detailEyebrow}>IL RESTE À ENCAISSER</span>
          <strong className={styles.outstandingTotal}>3 600 <small>MAD</small></strong>
          <p>Le solde de chaque facture reste visible.</p>
          <div><span>Client B · Démo</span><strong>1 800 MAD</strong></div>
          <div><span>Client C · Démo</span><strong>1 800 MAD</strong></div>
          <span className={styles.expectedCaption}>Soldes clients illustratifs</span>
        </aside>
      </div>
      <div className={styles.supplierNote}><ShoppingBag size={17} aria-hidden="true" /><p><strong>Les devis, c’est PRO.</strong> ESSENTIEL s’arrête aux factures, aux règlements et aux journaux.</p></div>
    </>
  );
}

function TreasuryPreview({ id }: { id: string }) {
  return (
    <>
      <div className={styles.screenHeading}>
        <div><p className={styles.screenEyebrow}>TRÉSORERIE / VUE D’ENSEMBLE</p><h3>Vos chiffres, en perspective.</h3></div>
        <span className={styles.period}>Novembre 2026 · Exemple</span>
      </div>
      <div className={styles.metrics}>
        <div><span>Solde illustratif</span><strong>18 000 <small>MAD</small></strong></div>
        <div><span>Encaissements du mois</span><strong>9 000 <small>MAD</small></strong></div>
        <div><span>Paiements du mois</span><strong>2 400 <small>MAD</small></strong></div>
      </div>
      <div className={styles.treasuryLayout}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeading}><h4>Le fil de votre trésorerie</h4><span>MAD</span></div>
          <svg className={styles.chart} viewBox="0 0 520 208" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}>
            <title id={`${id}-chart-title`}>Évolution fictive de la trésorerie en novembre</title>
            <desc id={`${id}-chart-description`}>Un solde initial de 11 400 MAD, 9 000 MAD de règlements clients et 2 400 MAD de paiements fournisseurs donnent un solde de 18 000 MAD.</desc>
            <g className={styles.chartGrid}><path d="M42 28H502M42 96H502M42 164H502" /></g>
            <g className={styles.chartLabels}><text x="0" y="32">20 k</text><text x="0" y="100">10 k</text><text x="23" y="168">0</text><text x="42" y="198">01 nov.</text><text x="167" y="198">07</text><text x="288" y="198">14</text><text x="401" y="198">21</text><text x="502" y="198" textAnchor="end">30 nov.</text></g>
            <path d="M42 86H76V38H100V54H124V42H502V164H42Z" fill="#e0eee5" />
            <path d="M42 86H76V38H100V54H124V42H502" fill="none" stroke="#426b5b" strokeWidth="3" strokeLinejoin="round" />
          </svg>
          <p className={styles.chartCaption}>Des mouvements enregistrés à une vue d’ensemble.</p>
        </div>
        <div className={styles.movements}>
          <h4>Derniers mouvements</h4>
          <div><span><strong>Règlement client B</strong><small>06 nov. · Banque</small></span><b>+ 1 800</b></div>
          <div><span><strong>Paiement fournisseur</strong><small>05 nov. · Banque</small></span><b className={styles.expense}>− 2 400</b></div>
          <div><span><strong>Règlement client A</strong><small>03 nov. · Banque</small></span><b>+ 7 200</b></div>
          <p>Montants fictifs en MAD</p>
        </div>
      </div>
      <p className={styles.screenNote}>Banques, caisses, journaux et indicateurs : retrouvez les repères de votre activité.</p>
    </>
  );
}

export function LandingEssentiel() {
  const essential = getPlanDefinition("essentiel");
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section id="essentiel" className={styles.section} aria-labelledby="essentiel-title">
      <span id="modules" className={styles.anchor} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.domains} aria-label="Ce que couvre ESSENTIEL">
          <span><FileText size={17} aria-hidden="true" /> Facturez</span><span><Landmark size={17} aria-hidden="true" /> Suivez</span><span><BookOpen size={17} aria-hidden="true" /> Pilotez</span>
        </div>
        <div className={styles.introduction}>
          <div><p className={styles.eyebrow}><span>FACTUREZ</span> / ESSENTIEL</p><h2 id="essentiel-title">Des factures conformes,<br /><span>prêtes à envoyer.</span></h2></div>
          <p className={styles.introCopy}>ICE, IF et RC, HT, TVA et TTC en dirhams, puis le suivi des règlements et les journaux. Les devis, les commandes et le stock sont dans PRO.</p>
        </div>
        <div id="features" className={styles.product} aria-describedby={`${id}-caption`}>
          <div className={styles.productBar}><span className={styles.wordmark}>Felexia<span>ERP</span></span><p id={`${id}-caption`}>Aperçu illustratif · Données fictives</p></div>
          <div className={styles.workspace}>
            <aside className={styles.sidebar} aria-hidden="true">
              <span className={styles.companyMark}>FE</span><strong>Votre entreprise</strong><span className={styles.workspaceCaption}>ESPACE ESSENTIEL</span>
              <div className={activeTab === 0 ? styles.sideActive : styles.sideItem}><FileText size={17} /> Factures</div>
              <div className={activeTab === 1 ? styles.sideActive : styles.sideItem}><Landmark size={17} /> Règlements</div>
              <div className={activeTab === 2 ? styles.sideActive : styles.sideItem}><BookOpen size={17} /> Journaux</div>
              <span className={styles.sidebarFoot}>Une même vue<br />sur votre quotidien.</span>
            </aside>
            <div className={styles.productMain}>
              <div className={styles.tabs} role="tablist" aria-label="Explorer l’aperçu ESSENTIEL">
                {tabs.map(({ label, icon: Icon }, index) => (
                  <button key={label} ref={(element) => { tabRefs.current[index] = element; }} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={activeTab === index} aria-controls={`${id}-panel-${index}`} tabIndex={activeTab === index ? 0 : -1} className={activeTab === index ? styles.activeTab : styles.tab} onClick={() => setActiveTab(index)} onKeyDown={(event) => handleTabKeyDown(event, index)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>
                ))}
              </div>
              {tabs.map((tab, index) => (
                <div key={tab.label} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={activeTab !== index} tabIndex={0} className={styles.panel}>
                  {index === 0 ? <InvoicePreview /> : index === 1 ? <PaymentsPreview /> : <TreasuryPreview id={id} />}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.afterProduct}>
          <p>Facturez, suivez les règlements, retrouvez les journaux.<br /><strong>Dès {essential.monthlyPrice.toLocaleString("fr-FR")} MAD HT/mois, après {DEFAULT_TRIAL_DURATION_LABEL} d’essai.</strong></p>
          <div className={styles.actions}><Link href="/login?mode=register" className={styles.primaryAction}>Essayer gratuitement <ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="#pricing" className={styles.textAction}>Voir les tarifs <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          <p className={styles.priceNote}>15 jours · sans carte bancaire · les devis sont dans PRO</p>
        </div>
        <div id="facturation-electronique" className={styles.einvoice}>
          <span className={styles.einvoiceIcon}><FileCheck2 size={23} aria-hidden="true" /></span>
          <div><h3>Vos factures, jusqu’à l’archivage.</h3><p>Génération PDF/XML, émission et archivage inclus dans ESSENTIEL et PRO.</p></div>
          <div className={styles.resourceLinks}><Link href="/facturation-electronique-maroc">La facture électronique <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/logiciel-facturation-maroc">La facturation au Maroc <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        </div>
      </div>
    </section>
  );
}
