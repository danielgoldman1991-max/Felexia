import { BookOpen, FileText, Landmark, ShoppingCart } from "lucide-react";

const modules = [
  { icon: FileText, title: "Ventes", description: "Clients, factures de vente et règlements reçus." },
  { icon: ShoppingCart, title: "Achats", description: "Fournisseurs, factures d’achat et paiements." },
  { icon: Landmark, title: "Trésorerie", description: "Comptes bancaires, caisses et mouvements." },
  { icon: BookOpen, title: "Journaux", description: "Vos journaux et écritures comptables accessibles directement." },
];
export function LandingModules() {
  return <section id="modules" className="scroll-mt-24 bg-[#F8FBFF] py-20 lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-widest text-[#1456B8]">L’essentiel au quotidien</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#061B3F] sm:text-4xl">Quatre repères, un parcours clair</h2><p className="mt-4 text-lg leading-relaxed text-slate-600">Un espace volontairement simple pour facturer, régler et suivre votre activité.</p></div>
    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{modules.map((module) => <div key={module.title} className="rounded-2xl border border-slate-200 bg-white p-6"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50"><module.icon className="h-5 w-5 text-[#1456B8]" /></span><h3 className="mt-4 text-base font-bold text-[#061B3F]">{module.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{module.description}</p></div>)}</div>
    <p className="mt-8 text-center text-sm text-slate-600">Besoin d’aller plus loin ? Les modules complémentaires sont accessibles sur demande auprès de notre équipe.</p>
  </div></section>;
}
