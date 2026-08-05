import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#F5F9FF] to-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] xl:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-[#1E66D0] ring-1 ring-blue-100">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              Mini-ERP pour PME marocaines
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#061B3F] sm:text-5xl sm:leading-[1.05] lg:text-6xl lg:leading-[1.02] xl:text-7xl">
              Toute votre PME
              <br className="hidden sm:block" />
              dans{" "}
              <span className="bg-gradient-to-r from-[#1E66D0] to-[#38A3FF] bg-clip-text text-transparent">
                un seul outil
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              FelexiaERP réunit ventes, achats, stock, trésorerie, comptabilité, documents et
              prévisions dans une plateforme simple, sécurisée et pensée pour les entreprises
              marocaines.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="landingPrimary" className="h-12 px-7">
                <Link href="/login?mode=register">
                  <span className="relative z-10 !text-white">
                    Commencer l&apos;essai Essentiel gratuit
                  </span>
                  <ArrowRight className="relative z-10 h-4 w-4 !text-white" />
                </Link>
              </Button>
              <Button asChild variant="landingSecondary" className="h-12 px-7">
                <Link href="#pricing">
                  <span className="relative z-10 !text-[#0F2548]">Voir les tarifs</span>
                </Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
              {["12 modules intégrés", "Essai Essentiel gratuit", "Sans engagement"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50">
                    <Check className="h-3 w-3 text-[#1E66D0]" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative lg:-mr-8 xl:-mr-12">
            <div className="absolute -inset-6 -z-10 rounded-[44px] bg-blue-500/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/5">
              <Image
                src="/landing/felexia-erp-dashboard-hero.png"
                alt="Aperçu du tableau de bord FelexiaERP"
                width={1672}
                height={941}
                priority
                sizes="(max-width: 1024px) 100vw, 760px"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
