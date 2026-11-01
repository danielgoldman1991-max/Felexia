import { Archive, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Building2, Check, ChevronDown, FileCode2, FileText, Home, Landmark, MoreHorizontal, Plus, Search, Settings2, ShoppingBag, Users, Wallet } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "./landing-laptop-interface.css";

const documents = [
  { reference: "FAC-2611-00001", client: "Client professionnel", amount: "1 200,00", status: "Émise", kind: "issued" },
  { reference: "FAC-2611-00002", client: "Client particulier", amount: "3 600,00", status: "À préparer", kind: "pending" },
  { reference: "AV-2611-00001", client: "Client professionnel", amount: "240,00", status: "Validée", kind: "ready" },
  { reference: "FAC-2611-00003", client: "Client export", amount: "8 400,00", status: "Émise", kind: "issued" },
];

export function LandingLaptopInterface() {
  return (
    <div className="laptop-ui">
      <aside className="laptop-ui-sidebar">
        <div className="laptop-ui-brand"><BrandLogo height={39} /></div>
        <div className="laptop-ui-workspace"><span><Building2 size={17} /></span><div><strong>Votre entreprise</strong><small>Espace de gestion</small></div><ChevronDown size={13} /></div>
        <div className="laptop-ui-nav-label">VOTRE ESPACE</div>
        <div className="laptop-ui-nav-item"><Home size={17} /><span>Accueil</span></div>
        <div className="laptop-ui-nav-item laptop-ui-nav-parent"><FileText size={17} /><span>Ventes</span><ChevronDown size={13} /></div>
        <div className="laptop-ui-subnav"><span className="laptop-ui-nav-active"><i />Factures clients</span><span>Règlements reçus</span><span>Facturation électronique</span></div>
        <div className="laptop-ui-nav-item"><ShoppingBag size={17} /><span>Achats</span></div>
        <div className="laptop-ui-nav-item"><Landmark size={17} /><span>Trésorerie</span></div>
        <div className="laptop-ui-nav-item"><BookOpen size={17} /><span>Journaux</span></div>
        <div className="laptop-ui-sidebar-bottom"><div className="laptop-ui-nav-item"><Settings2 size={17} /><span>Paramètres</span></div><div className="laptop-ui-account"><span>FE</span><div><strong>Votre équipe</strong><small>Offre Essentiel</small></div><MoreHorizontal size={16} /></div></div>
      </aside>

      <div className="laptop-ui-main">
        <div className="laptop-ui-topbar"><div><span>Ventes</span><i>/</i><strong>Factures clients</strong></div><div className="laptop-ui-search"><Search size={14} /><span>Rechercher dans votre espace</span><small>⌘ K</small></div><Bell size={17} /><span className="laptop-ui-avatar">FE</span></div>
        <div className="laptop-ui-body">
          <div className="laptop-ui-page-heading"><div><div className="laptop-ui-page-eyebrow">VOTRE GESTION AU QUOTIDIEN</div><h2>Ventes et facturation</h2><p>Vos clients, vos factures et vos règlements, au même endroit.</p></div><div className="laptop-ui-new-document"><Plus size={15} />Créer une facture</div></div>

          <div className="laptop-ui-mobile-document"><div className="laptop-ui-mobile-summary"><strong>FAC-2611-00001</strong><span>Client professionnel</span><div><Check size={24} />Émise et archivée</div><small>Total TTC</small><b>1 200,00<em>MAD</em></b></div><div className="laptop-ui-mobile-formats"><div><FileText size={48} /><span><strong>Facture PDF</strong><small>Votre document</small></span><ArrowDownToLine size={30} /></div><div><FileCode2 size={48} /><span><strong>Fichier XML</strong><small>Données structurées</small></span><ArrowDownToLine size={30} /></div></div></div>

          <div className="laptop-ui-kpis">
            <div><span className="laptop-ui-kpi-icon"><Wallet size={17} /></span><span><small>Ventes du mois</small><strong>24 800<em>MAD</em></strong></span><ArrowUpRight size={15} /></div>
            <div><span className="laptop-ui-kpi-icon"><Users size={17} /></span><span><small>À encaisser</small><strong>8 400<em>MAD</em></strong></span><span className="laptop-ui-kpi-caption">Clients</span></div>
            <div><span className="laptop-ui-kpi-icon laptop-ui-kpi-icon-mint"><ShoppingBag size={17} /></span><span><small>Achats du mois</small><strong>16 600<em>MAD</em></strong></span><span className="laptop-ui-kpi-dot" /></div>
          </div>

          <div className="laptop-ui-documents-grid">
            <div className="laptop-ui-document-list">
              <div className="laptop-ui-list-heading"><h3>Vos documents</h3><span>Tous les documents<ChevronDown size={12} /></span></div>
              <div className="laptop-ui-list-tabs"><span className="laptop-ui-tab-active">Tous <b>4</b></span><span>À préparer</span><span>Émis</span><Search size={14} /></div>
              <div className="laptop-ui-table-head"><span>DOCUMENT / CLIENT</span><span>MONTANT TTC</span><span>ÉTAT</span></div>
              {documents.map((document, index) => <div key={document.reference} className={`laptop-ui-table-row${index === 0 ? " laptop-ui-row-selected" : ""}`}><div><span className="laptop-ui-table-file"><FileText size={17} /></span><span><strong>{document.reference}</strong><small>{document.client}</small></span></div><span className="laptop-ui-table-amount">{document.amount}<small>MAD</small></span><span className={`laptop-ui-document-status laptop-ui-status-${document.kind}`}>{document.kind === "issued" ? <Check size={10} /> : null}{document.status}</span></div>)}
              <div className="laptop-ui-list-footer"><span>Factures et avoirs clients</span><span>4 documents</span></div>
            </div>

            <div className="laptop-ui-detail">
              <div className="laptop-ui-detail-heading"><span><FileText size={16} />VOTRE DOCUMENT</span><MoreHorizontal size={16} /></div>
              <h3>FAC-2611-00001</h3><p className="laptop-ui-detail-client">Client professionnel</p>
              <div className="laptop-ui-issued"><span><Check size={12} /></span>Émise et archivée</div>
              <div className="laptop-ui-detail-total"><span>Total TTC</span><strong>1 200,00<small>MAD</small></strong></div>
              <div className="laptop-ui-files"><div><span className="laptop-ui-format-icon"><FileText size={18} /></span><span><strong>Facture PDF</strong><small>Votre document à partager</small></span><ArrowDownToLine size={15} /></div><div><span className="laptop-ui-format-icon laptop-ui-format-xml"><FileCode2 size={18} /></span><span><strong>Document XML</strong><small>Vos données structurées</small></span><ArrowDownToLine size={15} /></div></div>
              <div className="laptop-ui-version"><Archive size={13} /><span>Version 01 · Figée à l’émission</span></div>
            </div>
          </div>
          <div className="laptop-ui-bottom-note"><span><i />Votre espace entreprise</span><span>Vos documents. Votre historique. Une vue claire.</span></div>
        </div>
      </div>
    </div>
  );
}
