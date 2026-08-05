import { FileText, Landmark, Package, PackagePlus, ShoppingCart, Wallet } from "lucide-react";

const modules = [
  {
    icon: ShoppingCart,
    title: "Ventes",
    description: "Devis, commandes, bons de livraison, factures.",
  },
  {
    icon: PackagePlus,
    title: "Achats",
    description: "Commandes, réceptions, factures fournisseurs.",
  },
  {
    icon: Package,
    title: "Stock",
    description: "Articles, entrepôts, mouvements, inventaires.",
  },
  {
    icon: Wallet,
    title: "Trésorerie",
    description: "Banques, caisse, paiements, encaissements, prévisions.",
  },
  {
    icon: Landmark,
    title: "Comptabilité",
    description: "Plan comptable marocain, écritures, journaux, balance.",
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Modèles, envoi PDF, exports, stockage.",
  },
];

export function LandingModules() {
  return (
    <section id="modules" className="scroll-mt-24 bg-[#F8FBFF] py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-[#0B63F6]">
            Modules clés
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#061B3F] sm:text-4xl">
            Tous les modules essentiels pour gérer votre PME
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Activez les modules dont vous avez besoin. Commencez simple, évoluez à votre rythme.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {modules.map((module) => (
            <div
              key={module.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <module.icon className="h-5 w-5 text-[#0B63F6]" />
              </span>
              <h3 className="mt-4 text-base font-bold text-[#061B3F]">{module.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{module.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
