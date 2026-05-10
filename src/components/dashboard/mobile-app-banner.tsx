import { QrCode, Smartphone } from "lucide-react";

export function MobileAppBanner() {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold text-blue-300">Application mobile</p>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Gerez votre entreprise partout, a tout moment</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Accedez a vos donnees, creez des documents et suivez votre activite depuis l'application mobile.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950">App Store</button>
            <button type="button" className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-bold text-white">Google Play</button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-5">
          <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-white/15 bg-white/10">
            <QrCode className="h-16 w-16 text-white" />
          </div>
          <div className="relative h-48 w-28 rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-2xl">
            <div className="h-full rounded-[1.5rem] bg-white p-3 text-slate-950">
              <Smartphone className="mb-5 h-5 w-5 text-blue-600" />
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-slate-200" />
                <div className="h-12 rounded-2xl bg-blue-600" />
                <div className="h-3 rounded-full bg-slate-200" />
                <div className="h-3 w-2/3 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
