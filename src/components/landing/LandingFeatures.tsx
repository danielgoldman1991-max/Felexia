import { BookOpen, FileText, Landmark, ShoppingCart } from "lucide-react";
const families = [
  { title: "Facturer mes clients", icon: FileText, items: ["Clients et coordonnées", "Factures avec TVA et remises", "PDF avec votre logo", "Suivi des montants restant à régler"] },
  { title: "Suivre mes achats", icon: ShoppingCart, items: ["Fiches fournisseurs", "Saisie directe des factures d’achat", "Suivi des factures à payer", "Règlements fournisseurs"] },
  { title: "Suivre mon argent", icon: Landmark, items: ["Comptes bancaires et caisses", "Encaissements clients", "Paiements fournisseurs", "Mouvements et soldes"] },
  { title: "Garder la main sur mes journaux", icon: BookOpen, items: ["Journaux de vente et d’achat", "Journaux de banque et de caisse", "Consultation des écritures", "Écritures liées aux opérations"] },
];
export function LandingFeatures() {
  return <section id="features" className="scroll-mt-24 bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-[#1456B8]">Fonctionnalités</p><h2 className="mt-3 text-3xl font-bold text-[#0B2A5B] sm:text-4xl">Tout ce qu’il faut pour démarrer</h2><p className="mt-4 text-lg text-slate-600">Une interface centrée sur les tâches que vous utilisez chaque jour.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{families.map((family) => <div key={family.title} className="rounded-2xl border border-slate-200 bg-[#F8FBFF] p-6"><family.icon className="h-6 w-6 text-[#1456B8]" /><h3 className="mt-4 text-lg font-bold text-[#0B2A5B]">{family.title}</h3><ul className="mt-4 space-y-3">{family.items.map((item) => <li key={item} className="text-sm leading-6 text-slate-600">{item}</li>)}</ul></div>)}</div></div></section>;
}
