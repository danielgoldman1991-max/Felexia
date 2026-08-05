import { FileText, Landmark, Wallet } from "lucide-react";

const articles = [
  {
    icon: FileText,
    tag: "Guide",
    title: "Comment choisir un ERP pour votre PME ?",
    description:
      "Les critères essentiels : modules indispensables, budget, simplicité d'adoption et évolutivité.",
  },
  {
    icon: Landmark,
    tag: "Fiscalité",
    title: "TVA au Maroc : les bases pour bien la gérer",
    description:
      "Taux applicables, déclaration mensuelle, TVA collectée et déductible : l'essentiel à connaître.",
  },
  {
    icon: Wallet,
    tag: "Trésorerie",
    title: "Simplifiez votre trésorerie en 5 étapes",
    description:
      "Suivi des encaissements, prévisions à 90 jours et rapprochements pour garder le contrôle.",
  },
];

export function LandingResources() {
  return (
    <section id="resources" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Ressources
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Des guides pratiques pour piloter votre PME
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Bientôt disponibles : nos articles pour mieux gérer votre entreprise au Maroc.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.title}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-[#F4F8FF] p-7 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E66D0] to-[#155EEF] shadow-md shadow-blue-600/20">
                  <article.icon className="h-6 w-6 text-white" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1E66D0]">
                  {article.tag}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-bold leading-snug text-[#0B2A5B]">{article.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{article.description}</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-400">
                Bientôt disponible
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-500">
                  En préparation
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
