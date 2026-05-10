import { AlertTriangle, Banknote, Building2, FileClock, Receipt, TrendingUp } from "lucide-react";

export const kpiCards = [
  {
    title: "Chiffre d'affaires",
    value: "125 430,00 DH",
    change: "+18,4%",
    caption: "vs 01 Avr - 30 Avr 2024",
    tone: "success",
    icon: TrendingUp,
  },
  {
    title: "Encaissements",
    value: "98 200,00 DH",
    change: "+23,7%",
    caption: "vs 01 Avr - 30 Avr 2024",
    tone: "success",
    icon: Banknote,
  },
  {
    title: "Impayes",
    value: "27 230,00 DH",
    change: "+8,6%",
    caption: "12 factures impayees",
    tone: "danger",
    icon: AlertTriangle,
  },
  {
    title: "Tresorerie disponible",
    value: "64 820,00 DH",
    change: "+15,3%",
    caption: "Tous comptes confondus",
    tone: "success",
    icon: Building2,
  },
];

export const revenueSeries = [
  { label: "Jan", value: 52000 },
  { label: "Fev", value: 61000 },
  { label: "Mar", value: 58000 },
  { label: "Avr", value: 73000 },
  { label: "Mai", value: 125430 },
  { label: "Juin", value: 118000 },
  { label: "Juil", value: 132000 },
];

export const salesSplit = [
  { label: "Produits finis", value: 45, amount: "56 443 DH", color: "#2563eb" },
  { label: "Services", value: 28, amount: "35 120 DH", color: "#22c55e" },
  { label: "Marchandises", value: 17, amount: "21 323 DH", color: "#f59e0b" },
  { label: "Autres", value: 10, amount: "12 543 DH", color: "#64748b" },
];

export const operationalStats = [
  { label: "Devis en attente", value: "8", amount: "32 450,00 DH", icon: FileClock, href: "/vente/devis" },
  { label: "Commandes en cours", value: "5", amount: "45 780,00 DH", icon: Receipt, href: "/vente/commandes" },
  { label: "Livraisons a faire", value: "7", amount: "23 190,00 DH", icon: Receipt, href: "/vente/livraisons" },
  { label: "Stocks faibles", value: "3", amount: "Voir les alertes", icon: AlertTriangle, href: "/stock" },
];

export const activityFeed = [
  { title: "Facture F-2024-0156 creee", time: "Il y a 12 min", tone: "info" },
  { title: "Paiement recu de 15 000,00 DH", time: "Il y a 34 min", tone: "success" },
  { title: "Devis D-2024-0327 valide", time: "10:42", tone: "success" },
  { title: "Stock ajuste pour Produit A", time: "09:18", tone: "warning" },
  { title: "Facture F-2024-0155 payee", time: "Hier", tone: "success" },
];

export const topClients = [
  { name: "Maroc Distribution", amount: "38 450,00 DH", trend: "+12%" },
  { name: "Societe Amal SARL", amount: "28 900,00 DH", trend: "+8%" },
  { name: "BTP Plus", amount: "17 850,00 DH", trend: "+5%" },
  { name: "Green Tech", amount: "12 600,00 DH", trend: "+3%" },
  { name: "Immo Invest", amount: "9 630,00 DH", trend: "+2%" },
];
