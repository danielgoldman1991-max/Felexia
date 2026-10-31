import { ArrowRight, ShoppingCart, FileText } from "lucide-react";
const flows = [
  { title: "Je vends", icon: FileText, steps: ["Client", "Facture de vente", "Règlement reçu", "Trésorerie & journaux"] },
  { title: "J’achète", icon: ShoppingCart, steps: ["Fournisseur", "Facture d’achat", "Paiement", "Trésorerie & journaux"] },
];
export function LandingWorkflow() {
  return <section className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-[#1456B8]">Un parcours direct</p><h2 className="mt-3 text-3xl font-bold text-[#0B2A5B] sm:text-4xl">De la facture au règlement</h2><p className="mt-4 text-lg leading-relaxed text-slate-600">Enregistrez directement vos factures. Retrouvez vos paiements dans la trésorerie et consultez les écritures associées.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-2">{flows.map((flow) => <div key={flow.title} className="rounded-3xl border border-slate-200 bg-[#F8FBFF] p-6 sm:p-8"><h3 className="flex items-center gap-3 text-lg font-bold text-[#0B2A5B]"><flow.icon className="h-5 w-5 text-[#1456B8]" />{flow.title}</h3><ol className="mt-6 flex flex-wrap gap-y-3">{flow.steps.map((step, index) => <li key={step} className="flex items-center"><span className="rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-medium text-[#0B2A5B]">{step}</span>{index < flow.steps.length - 1 ? <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-[#1456B8]" /> : null}</li>)}</ol></div>)}</div></div></section>;
}
