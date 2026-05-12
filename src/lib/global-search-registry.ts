export type GlobalSearchCategory =
  | "Acces rapide"
  | "Tiers"
  | "Articles"
  | "Vente"
  | "Facturation"
  | "Achats"
  | "Stock"
  | "Tresorerie";

export type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  category: GlobalSearchCategory;
  type: string;
  keywords?: string[];
};

export const GLOBAL_SEARCH_REGISTRY: GlobalSearchResult[] = [
  { id: "dashboard", title: "Tableau de bord", subtitle: "Vue generale Felexia", href: "/dashboard", category: "Acces rapide", type: "route", keywords: ["dashboard", "accueil", "pilotage"] },
  { id: "tiers", title: "Tiers", subtitle: "Clients, prospects et fournisseurs", href: "/tiers", category: "Tiers", type: "route", keywords: ["crm", "client", "fournisseur", "prospect"] },
  { id: "tiers-prospects", title: "Prospects", subtitle: "Liste des prospects", href: "/tiers/prospects", category: "Tiers", type: "route", keywords: ["prospect", "crm"] },
  { id: "tiers-clients", title: "Clients", subtitle: "Liste des clients", href: "/tiers/clients", category: "Tiers", type: "route", keywords: ["client"] },
  { id: "tiers-fournisseurs", title: "Fournisseurs", subtitle: "Liste des fournisseurs", href: "/tiers/fournisseurs", category: "Tiers", type: "route", keywords: ["fournisseur", "achat"] },
  { id: "new-prospect", title: "Nouveau prospect", subtitle: "Creer un prospect", href: "/tiers/new?type=prospect", category: "Tiers", type: "create", keywords: ["creer prospect"] },
  { id: "new-client", title: "Nouveau client", subtitle: "Creer un client", href: "/tiers/new?type=customer", category: "Tiers", type: "create", keywords: ["creer client"] },
  { id: "new-supplier", title: "Nouveau fournisseur", subtitle: "Creer un fournisseur", href: "/tiers/new?type=supplier", category: "Tiers", type: "create", keywords: ["creer fournisseur"] },
  { id: "articles", title: "Articles / Services", subtitle: "Catalogue produits et services", href: "/articles", category: "Articles", type: "route", keywords: ["produit", "service", "article"] },
  { id: "new-product", title: "Nouvel article/service", subtitle: "Creer un produit ou service", href: "/articles/new", category: "Articles", type: "create", keywords: ["nouveau produit", "nouveau service"] },
  { id: "categories", title: "Categories", subtitle: "Categories articles", href: "/articles/categories", category: "Articles", type: "route", keywords: ["categorie"] },
  { id: "units", title: "Unites", subtitle: "Unites de mesure", href: "/articles/unites", category: "Articles", type: "route", keywords: ["unite"] },
  { id: "tax", title: "TVA", subtitle: "Taux de TVA", href: "/articles/tva", category: "Articles", type: "route", keywords: ["tva", "taxe"] },
  { id: "sales", title: "Vente", subtitle: "Cycle commercial client", href: "/vente", category: "Vente", type: "route", keywords: ["vente", "commercial"] },
  { id: "quotes", title: "Devis", subtitle: "Devis clients", href: "/vente/devis", category: "Vente", type: "route", keywords: ["devis"] },
  { id: "new-quote", title: "Nouveau devis", subtitle: "Creer un devis client", href: "/vente/devis/new", category: "Vente", type: "create", keywords: ["creer devis"] },
  { id: "orders", title: "Commandes clients", subtitle: "Commandes de vente", href: "/vente/commandes", category: "Vente", type: "route", keywords: ["commande client"] },
  { id: "new-order", title: "Nouvelle commande client", subtitle: "Creer une commande client", href: "/vente/commandes/new", category: "Vente", type: "create", keywords: ["creer commande client"] },
  { id: "deliveries", title: "Bons de livraison", subtitle: "Livraisons clients", href: "/vente/livraisons", category: "Vente", type: "route", keywords: ["bl", "livraison"] },
  { id: "new-delivery", title: "Nouveau bon de livraison", subtitle: "Creer un BL client", href: "/vente/livraisons/new", category: "Vente", type: "create", keywords: ["creer bl"] },
  { id: "returns", title: "Retours clients", subtitle: "Bons de retour", href: "/vente/retours", category: "Vente", type: "route", keywords: ["retour client"] },
  { id: "billing", title: "Facturation", subtitle: "Facturation client", href: "/facturation", category: "Facturation", type: "route", keywords: ["facture", "paiement"] },
  { id: "invoices", title: "Factures clients", subtitle: "Liste des factures", href: "/facturation/factures", category: "Facturation", type: "route", keywords: ["facture client"] },
  { id: "new-invoice", title: "Nouvelle facture client", subtitle: "Creer une facture", href: "/facturation/factures/new", category: "Facturation", type: "create", keywords: ["creer facture"] },
  { id: "customer-payments", title: "Paiements clients", subtitle: "Reglements clients", href: "/facturation/paiements", category: "Facturation", type: "route", keywords: ["paiement client", "reglement"] },
  { id: "new-customer-payment", title: "Nouveau paiement client", subtitle: "Encaisser un reglement", href: "/facturation/paiements/new", category: "Facturation", type: "create", keywords: ["encaissement", "reglement"] },
  { id: "reminders", title: "Relances clients", subtitle: "Suivi des impayes", href: "/facturation/relances", category: "Facturation", type: "route", keywords: ["relance", "impaye"] },
  { id: "new-reminder", title: "Nouvelle relance client", subtitle: "Creer une relance", href: "/facturation/relances/new", category: "Facturation", type: "create", keywords: ["creer relance"] },
  { id: "credit-notes", title: "Avoirs clients", subtitle: "Avoirs et credits clients", href: "/facturation/avoirs", category: "Facturation", type: "route", keywords: ["avoir"] },
  { id: "new-credit-note", title: "Nouvel avoir client", subtitle: "Creer un avoir", href: "/facturation/avoirs/new", category: "Facturation", type: "create", keywords: ["creer avoir"] },
  { id: "purchases", title: "Achats", subtitle: "Cycle fournisseur", href: "/achats", category: "Achats", type: "route", keywords: ["achat"] },
  { id: "purchase-orders", title: "Commandes fournisseurs", subtitle: "Commandes d'achat", href: "/achats/commandes", category: "Achats", type: "route", keywords: ["commande fournisseur"] },
  { id: "new-purchase-order", title: "Nouvelle commande fournisseur", subtitle: "Creer une commande fournisseur", href: "/achats/commandes/new", category: "Achats", type: "create", keywords: ["creer commande fournisseur"] },
  { id: "supplier-receipts", title: "Receptions fournisseurs", subtitle: "Receptions achats", href: "/achats/receptions", category: "Achats", type: "route", keywords: ["reception fournisseur"] },
  { id: "new-supplier-receipt", title: "Nouvelle reception fournisseur", subtitle: "Creer une reception", href: "/achats/receptions/new", category: "Achats", type: "create", keywords: ["creer reception"] },
  { id: "supplier-invoices", title: "Factures fournisseurs", subtitle: "Dettes fournisseurs", href: "/achats/factures", category: "Achats", type: "route", keywords: ["facture fournisseur"] },
  { id: "new-supplier-invoice", title: "Nouvelle facture fournisseur", subtitle: "Creer une facture fournisseur", href: "/achats/factures/new", category: "Achats", type: "create", keywords: ["creer facture fournisseur"] },
  { id: "supplier-payments", title: "Paiements fournisseurs", subtitle: "Reglements fournisseurs", href: "/achats/paiements", category: "Achats", type: "route", keywords: ["paiement fournisseur"] },
  { id: "new-supplier-payment", title: "Nouveau paiement fournisseur", subtitle: "Payer un fournisseur", href: "/achats/paiements/new", category: "Achats", type: "create", keywords: ["payer fournisseur"] },
  { id: "stock", title: "Stock", subtitle: "Vue globale du stock", href: "/stock", category: "Stock", type: "route", keywords: ["stock", "inventaire"] },
  { id: "stock-moves", title: "Mouvements par article", subtitle: "Historique stock", href: "/stock/mouvements", category: "Stock", type: "route", keywords: ["mouvement stock"] },
  { id: "stock-entry", title: "Entree manuelle", subtitle: "Ajouter du stock", href: "/stock/entrees/new", category: "Stock", type: "create", keywords: ["entree stock"] },
  { id: "stock-adjustment", title: "Ajustement stock", subtitle: "Ajuster un stock", href: "/stock/ajustements/new", category: "Stock", type: "create", keywords: ["ajustement"] },
  { id: "stock-locations", title: "Emplacements stock", subtitle: "Depots, magasins, sites", href: "/stock/emplacements", category: "Stock", type: "route", keywords: ["emplacement", "depot", "magasin"] },
  { id: "new-stock-location", title: "Nouvel emplacement stock", subtitle: "Creer un depot ou magasin", href: "/stock/emplacements/new", category: "Stock", type: "create", keywords: ["creer depot"] },
  { id: "treasury", title: "Tresorerie", subtitle: "Banques, caisses et flux", href: "/tresorerie", category: "Tresorerie", type: "route", keywords: ["banque", "caisse"] },
  { id: "treasury-accounts", title: "Comptes & caisses", subtitle: "Comptes de tresorerie", href: "/tresorerie/comptes", category: "Tresorerie", type: "route", keywords: ["banque", "caisse", "compte bancaire"] },
  { id: "new-treasury-account", title: "Nouveau compte bancaire / caisse", subtitle: "Creer un compte tresorerie", href: "/tresorerie/comptes/new", category: "Tresorerie", type: "create", keywords: ["creer banque", "creer caisse"] },
  { id: "treasury-moves", title: "Mouvements tresorerie", subtitle: "Entrees et sorties", href: "/tresorerie/mouvements", category: "Tresorerie", type: "route", keywords: ["mouvement tresorerie"] },
  { id: "new-treasury-move", title: "Nouveau mouvement tresorerie", subtitle: "Saisir une entree/sortie", href: "/tresorerie/mouvements/new", category: "Tresorerie", type: "create", keywords: ["creer mouvement"] },
  { id: "bank-statements", title: "Releves bancaires", subtitle: "Imports bancaires", href: "/tresorerie/releves", category: "Tresorerie", type: "route", keywords: ["releve bancaire"] },
  { id: "import-bank-statement", title: "Import releve bancaire", subtitle: "Importer un CSV bancaire", href: "/tresorerie/releves/import", category: "Tresorerie", type: "create", keywords: ["import bancaire"] },
  { id: "bank-reconciliation", title: "Rapprochement bancaire", subtitle: "Rapprocher banque et mouvements", href: "/tresorerie/rapprochement", category: "Tresorerie", type: "route", keywords: ["rapprochement", "banque"] },
  { id: "treasury-forecast", title: "Previsions tresorerie", subtitle: "Anticiper les flux", href: "/tresorerie/previsions", category: "Tresorerie", type: "route", keywords: ["prevision"] },
];

export const FREQUENT_SEARCH_RESULTS = GLOBAL_SEARCH_REGISTRY.filter((item) =>
  ["new-client", "new-quote", "new-invoice", "new-customer-payment", "stock-moves", "bank-reconciliation"].includes(item.id),
);

export function searchStaticRegistry(query: string, limit = 12) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return FREQUENT_SEARCH_RESULTS;
  return GLOBAL_SEARCH_REGISTRY.filter((item) => {
    const haystack = [item.title, item.subtitle, item.category, item.type, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return haystack.includes(normalized);
  }).slice(0, limit);
}
