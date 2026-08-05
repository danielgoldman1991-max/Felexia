import { FileCheck2, Landmark, MapPin, Percent } from "lucide-react";

const items = [
  {
    icon: MapPin,
    title: "Ancrée dans le contexte marocain",
    description:
      "Dirham marocain, plan comptable marocain, TVA à 20%, 14%, 10% et 7%, documents conformes aux attentes de vos partenaires.",
  },
  {
    icon: Percent,
    title: "TVA maîtrisée",
    description:
      "TVA collectée et déductible suivies par taux et par mois, avec un projet de déclaration préparatoire prérempli.",
  },
  {
    icon: Landmark,
    title: "États comptables locaux",
    description:
      "Balance, grand livre, bilan et comptes de produits et charges aux formats attendus par les experts-comptables marocains.",
  },
  {
    icon: FileCheck2,
    title: "Documents conformes",
    description:
      "Devis, factures et avoirs avec numérotation légale, mentions obligatoires et vos coordonnées et ICE.",
  },
];

export function LandingMorocco() {
  return (
    <section className="relative overflow-hidden bg-[#F8FBFF] py-20 lg:py-28">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Pensé pour le Maroc
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Aux normes du marché marocain
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            FelexiaERP est construit pour les réalités des PME marocaines : devises, fiscalité,
            comptabilité et documents.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#38A3FF] to-[#1E66D0] shadow-md shadow-blue-600/20">
                <item.icon className="h-6 w-6 text-white" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[#0B2A5B]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl rounded-2xl border border-amber-200/60 bg-amber-50/60 px-6 py-4 text-center text-sm leading-relaxed text-slate-600">
          Les fonctions fiscales, sociales et comptables de FelexiaERP sont{" "}
          <strong className="font-semibold text-slate-700">préparatoires</strong> : elles
          préparent vos données et vos projets de déclarations, mais ne remplacent ni
          l&apos;expertise d&apos;un expert-comptable ni les obligations déclaratives applicables au
          Maroc.
        </p>
      </div>
    </section>
  );
}
