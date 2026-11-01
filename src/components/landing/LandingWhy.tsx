import {
  BarChart3,
  Building2,
  CheckCircle2,
  Cloud,
  Rocket,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const points = [
  {
    icon: Building2,
    title: "Conçu pour le Maroc",
    description:
      "Montants en dirhams (MAD), TVA configurable et coordonnées de votre entreprise sur vos factures.",
  },
  {
    icon: Users2,
    title: "Pour PME & équipes",
    description:
      "Un espace clair pour gérer vos factures, vos clients, vos fournisseurs et leurs règlements.",
  },
  {
    icon: BarChart3,
    title: "Connecté & pilotable",
    description:
      "Factures et règlements sont reliés : retrouvez le montant restant à régler sans refaire vos calculs.",
  },
  {
    icon: CheckCircle2,
    title: "Toujours à jour",
    description:
      "Retrouvez vos ventes du mois, vos factures à encaisser, vos factures à payer et vos soldes.",
  },
  {
    icon: Cloud,
    title: "Accessible partout",
    description:
      "Accédez à votre espace depuis votre navigateur, sur ordinateur, tablette ou téléphone.",
  },
  {
    icon: Rocket,
    title: "Évolutif avec vous",
    description:
      "Démarrez avec ESSENTIEL. Passez à PRO pour retrouver les fonctions de l’ERP complet dans votre espace entreprise.",
  },
];

export function LandingWhy() {
  return (
    <section id="why" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Pourquoi FelexiaERP
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Pensé pour les PME marocaines, efficace pour votre quotidien
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Un ERP ne doit pas ralentir votre entreprise : le nôtre est simple à adopter et
            apporte une vraie valeur dès les premières semaines.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((point) => (
            <div
              key={point.title}
              className="group rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#F4F8FF] p-6 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#38A3FF] to-[#1E66D0] shadow-md shadow-blue-600/20 transition-transform group-hover:scale-105">
                <point.icon className="h-6 w-6 text-white" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[#0B2A5B]">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="landingPrimary" className="h-12 px-7">
            <Link href="/login?mode=register">
              <span className="relative z-10 !text-white">Tester FelexiaERP gratuitement</span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
