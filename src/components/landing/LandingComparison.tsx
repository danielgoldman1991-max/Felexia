import { Check, FileSpreadsheet, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const comparison = [
  { label: "Données reliées entre modules", excel: false, felexia: true },
  { label: "Prévisions de trésorerie", excel: "Bricolées", felexia: true },
  { label: "Suivi TVA par taux", excel: false, felexia: true },
  { label: "Documents PDF avec logo", excel: false, felexia: true },
  { label: "Accès multi-utilisateurs", excel: false, felexia: true },
  { label: "Travail depuis le navigateur", excel: false, felexia: true },
  { label: "Historique et traçabilité", excel: false, felexia: true },
  { label: "Évolutif et accompagné", excel: false, felexia: true },
];

export function LandingComparison() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Comparatif
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            L&apos;Excel a ses limites, pas FelexiaERP
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Les classeurs Excel se dupliquent, se perdent et ne communiquent pas entre eux.
            FelexiaERP relie toutes vos données en un seul endroit.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-3xl border border-slate-200 shadow-xl shadow-blue-900/5">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-gradient-to-r from-[#0F3D91] to-[#2F7CF6] px-6 py-5 sm:px-8">
            <p className="text-sm font-bold text-white">Comparaison</p>
            <p className="flex items-center gap-2 text-sm font-bold text-white/80">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </p>
            <p className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/20">F</span>
              FelexiaERP
            </p>
          </div>
          {comparison.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 px-6 py-4 sm:px-8 ${
                i % 2 === 0 ? "bg-white" : "bg-[#F8FBFF]/60"
              }`}
            >
              <p className="text-sm font-medium text-slate-700">{row.label}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                {row.excel === true ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 text-rose-400" />
                )}
                {row.excel === true ? "Oui" : row.excel === "Bricolées" ? "Bricolées" : "Non"}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0B2A5B]">
                <Check className="h-4 w-4 text-emerald-500" />
                Oui
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="landingPrimary" className="h-12 px-7">
            <Link href="#pricing">
              <span className="relative z-10 !text-white">Passez à un vrai ERP</span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
