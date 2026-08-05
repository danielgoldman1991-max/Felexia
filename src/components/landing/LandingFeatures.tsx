"use client";

import {
  FileText,
  Landmark,
  Package,
  Percent,
  PiggyBank,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";

interface Feature {
  title: string;
  description: string;
  level: string;
}

type FamilyKey = "vente" | "achats" | "stock" | "tresorerie" | "comptabilite" | "documents" | "tva" | "rh";

interface Family {
  key: FamilyKey;
  label: string;
  icon: typeof FileText;
  level: string;
  features: Feature[];
}

const FAMILIES: Family[] = [
  {
    key: "vente",
    label: "Vente & CRM",
    icon: Users,
    level: "Essentiel",
    features: [
      { title: "Gestion clients et prospects", description: "Fiche complète, historique et segmentation.", level: "Essentiel" },
      { title: "Devis, commandes et factures", description: "Cycle de vente fluide du devis au règlement.", level: "Essentiel" },
      { title: "Suivi des paiements clients", description: "Encaissements, relances et échéancier.", level: "Essentiel" },
      { title: "TVA et remises automatiques", description: "Calculs appliqués selon le type d'opération.", level: "Essentiel" },
    ],
  },
  {
    key: "achats",
    label: "Achats",
    icon: ShoppingCart,
    level: "Essentiel",
    features: [
      { title: "Commandes fournisseurs", description: "Création et suivi des bons de commande.", level: "Essentiel" },
      { title: "Réceptions de marchandises", description: "Entrées en stock automatiques à la livraison.", level: "Essentiel" },
      { title: "Factures d'achat", description: "Enregistrement et rapprochement avec la commande.", level: "Essentiel" },
      { title: "Suivi des paiements fournisseurs", description: "Échéances et sorties de trésorerie planifiées.", level: "Essentiel" },
    ],
  },
  {
    key: "stock",
    label: "Stock & Articles",
    icon: Package,
    level: "Essentiel",
    features: [
      { title: "Articles multi-dépôts", description: "Stocks suivis par dépôt et par variante.", level: "Essentiel" },
      { title: "Alertes de réapprovisionnement", description: "Seuils critiques et suggestions de commande.", level: "Essentiel" },
      { title: "Inventaires et ajustements", description: "Comptages réguliers avec historique.", level: "Essentiel" },
      { title: "Valorisation du stock", description: "Coût moyen pondéré automatique.", level: "Essentiel" },
    ],
  },
  {
    key: "tresorerie",
    label: "Trésorerie",
    icon: Wallet,
    level: "Essentiel",
    features: [
      { title: "Comptes et soldes", description: "Vue consolidée de tous vos comptes.", level: "Essentiel" },
      { title: "Paiements et rapprochements", description: "Pointage bancaire guidé pas à pas.", level: "Essentiel" },
      { title: "Prévisions à 90 jours", description: "Projection de trésorerie à partir des factures.", level: "Essentiel" },
      { title: "Budget et suivi", description: "Comparaison réalisé / prévu par période.", level: "Essentiel" },
    ],
  },
  {
    key: "comptabilite",
    label: "Comptabilité",
    icon: Landmark,
    level: "Essentiel",
    features: [
      { title: "Plan comptable marocain", description: "Traitement des opérations standard (IS, TVA...).", level: "Essentiel" },
      { title: "Écritures et journaux", description: "Générées automatiquement depuis les factures.", level: "Essentiel" },
      { title: "Rapprochements bancaires", description: "Pointage des écritures et soldes.", level: "Essentiel" },
      { title: "Bilan et balance", description: "Consultation et export des états financiers.", level: "Essentiel" },
    ],
  },
  {
    key: "documents",
    label: "Documents & Modèles",
    icon: FileText,
    level: "Essentiel",
    features: [
      { title: "Devis, factures, avoirs et BL", description: "Génération en un clic, numérotation auto.", level: "Essentiel" },
      { title: "PDF avec votre logo", description: "Modèles personnalisables au format PDF.", level: "Essentiel" },
      { title: "Envoi par email", description: "Transmission directe à vos clients.", level: "Essentiel" },
      { title: "Suivi des statuts", description: "Brouillon, envoyé, approuvé, payé.", level: "Essentiel" },
    ],
  },
  {
    key: "tva",
    label: "TVA & Exports",
    icon: Percent,
    level: "Business",
    features: [
      { title: "TVA avancée", description: "Gestion multi-taux et régimes spécifiques.", level: "Business" },
      { title: "Déclaration TVA (préparatoire)", description: "Aide au calcul de la déclaration mensuelle.", level: "Business" },
      { title: "Exports Excel et PDF", description: "Tous les listes exportables pour votre comptable.", level: "Business" },
      { title: "Automatisations", description: "Rappels de paiement et tâches récurrentes.", level: "Business" },
    ],
  },
  {
    key: "rh",
    label: "RH & Sécurité",
    icon: PiggyBank,
    level: "Premium",
    features: [
      { title: "Gestion des utilisateurs", description: "Invitations et rôles par département.", level: "Premium" },
      { title: "Permissions fines", description: "Accès aux modules selon le rôle.", level: "Premium" },
      { title: "Support prioritaire", description: "Assistance dédiée et accompagnement.", level: "Premium" },
      { title: "Toutes les fonctionnalités", description: "L'ensemble des modules et automatisations.", level: "Premium" },
    ],
  },
];

const levelStyles: Record<string, string> = {
  Essentiel: "border-slate-200 bg-slate-50 text-slate-600",
  Business: "border-blue-200 bg-blue-50 text-[#1E66D0]",
  Premium: "border-violet-200 bg-violet-50 text-violet-600",
};

export function LandingFeatures() {
  const [active, setActive] = useState<FamilyKey>("vente");
  const current = FAMILIES.find((family) => family.key === active) ?? FAMILIES[0];

  return (
    <section id="features" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Fonctionnalités
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Tout ce qu&apos;il faut, rien de superflu
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Huit familles de fonctionnalités pour couvrir le quotidien de votre entreprise, avec
            des évolutions progressives selon votre plan.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {FAMILIES.map((family) => (
            <button
              key={family.key}
              onClick={() => setActive(family.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                active === family.key
                  ? "border-transparent bg-[#1E66D0] text-white shadow-md shadow-blue-600/20"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-[#0B2A5B]"
              }`}
            >
              <family.icon className="h-4 w-4" />
              {family.label}
            </button>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-[#F4F8FF] p-8 lg:p-10">
          <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E66D0] to-[#155EEF]">
                <current.icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="text-xl font-bold text-[#0B2A5B]">{current.label}</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${levelStyles[current.level]}`}>
              {current.level}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {current.features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-100 bg-white p-5">
                <span className={`mb-3 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${levelStyles[feature.level]}`}>
                  {feature.level}
                </span>
                <h4 className="text-sm font-bold text-[#0B2A5B]">{feature.title}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
