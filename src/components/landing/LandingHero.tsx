import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, FileText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#F5F9FF] to-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 xl:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-[#1E66D0] ring-1 ring-blue-100"><span className="h-2 w-2 rounded-full bg-[#10B981]" />La gestion simple pour les PME marocaines</div>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-[#061B3F] sm:text-5xl lg:text-6xl">Vos factures.<br />Vos règlements.<br /><span className="text-[#1456B8]">L’essentiel, simplement.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Créez votre espace entreprise, saisissez vos factures de vente et d’achat, enregistrez leurs règlements et suivez votre trésorerie. Vos journaux restent à portée de main.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="landingPrimary" className="h-12 px-7"><Link href="/login?mode=register"><span className="relative z-10 !text-white">Démarrer gratuitement</span><ArrowRight className="relative z-10 h-4 w-4 !text-white" /></Link></Button>
              <Button asChild variant="landingSecondary" className="h-12 px-7"><Link href="#pricing"><span className="relative z-10 !text-[#0F2548]">Voir les tarifs</span></Link></Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">{["Sans carte bancaire", "Essai Essentiel gratuit", "Sans engagement"].map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#1456B8]" />{item}</span>)}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:p-8">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5"><span className="text-lg font-bold text-[#0B2A5B]">Votre quotidien, simplifié</span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#1456B8]">Aperçu illustratif</span></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#1456B8] p-4 !text-white"><FileText className="h-5 w-5" /><p className="mt-3 text-sm font-semibold !text-white">Facture de vente</p></div><div className="rounded-2xl border border-slate-200 p-4"><FileText className="h-5 w-5 text-[#1456B8]" /><p className="mt-3 text-sm font-semibold text-[#0B2A5B]">Facture d’achat</p></div></div>
            <div className="mt-6 space-y-3">{["1. Je crée ma facture", "2. J’enregistre son règlement", "3. Je retrouve le mouvement en trésorerie"].map((step) => <div key={step} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><span className="text-sm font-medium text-slate-700">{step}</span></div>)}</div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><WalletCards className="h-5 w-5 text-[#1456B8]" /><span className="text-sm leading-6 text-[#0B2A5B]">Mes factures, mes paiements et mes journaux dans le même espace.</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
