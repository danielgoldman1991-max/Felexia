import { ArrowRight, PackageCheck, PackagePlus, ShoppingCart } from "lucide-react";

const saleFlow = [
  { label: "Client", icon: null },
  { label: "Devis", icon: null },
  { label: "Commande", icon: null },
  { label: "Livraison", icon: null },
  { label: "Facture", icon: null },
  { label: "Paiement", icon: null },
  { label: "Comptabilité", icon: null },
];

const purchaseFlow = [
  { label: "Fournisseur", icon: null },
  { label: "Commande", icon: null },
  { label: "Réception", icon: null },
  { label: "Facture", icon: null },
  { label: "Paiement", icon: null },
  { label: "Trésorerie", icon: null },
  { label: "Comptabilité", icon: null },
];

export function LandingWorkflow() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Workflow métier
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            De la demande au règlement, tout est lié
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Chaque étape met automatiquement à jour les modules suivants : un paiement encaissé
            alimente la trésorerie, une livraison décrémente le stock, une facture génère l&apos;écriture
            comptable.
          </p>
        </div>

        <div className="mt-14 space-y-12">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-[#F4F8FF] to-white p-8 lg:p-10">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E66D0] to-[#155EEF]">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#0B2A5B]">Flux de vente</h3>
                  <p className="text-sm text-slate-500">Client → Devis → Commande → Livraison → Facture → Paiement → Comptabilité</p>
                </div>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1E66D0]">
                Cycle de vente complet
              </span>
            </div>
            <ol className="flex flex-wrap items-center gap-y-3">
              {saleFlow.map((step, i) => (
                <li key={step.label} className="flex items-center">
                  <span
                    className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                      i === 6
                        ? "border-transparent bg-[#1E66D0] text-white shadow-md shadow-blue-600/20"
                        : i % 2 === 0
                          ? "border-blue-100 bg-white text-[#0B2A5B]"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < saleFlow.length - 1 && (
                    <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-[#38A3FF]" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-[#F4F8FF] to-white p-8 lg:p-10">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#38A3FF] to-[#1E66D0]">
                  <PackagePlus className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#0B2A5B]">Flux d&apos;achat</h3>
                  <p className="text-sm text-slate-500">Fournisseur → Commande → Réception → Facture → Paiement → Trésorerie → Comptabilité</p>
                </div>
              </div>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-[#1E66D0]">
                Achats fiabilisés
              </span>
            </div>
            <ol className="flex flex-wrap items-center gap-y-3">
              {purchaseFlow.map((step, i) => (
                <li key={step.label} className="flex items-center">
                  <span
                    className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                      i === 6
                        ? "border-transparent bg-[#1E66D0] text-white shadow-md shadow-blue-600/20"
                        : i % 2 === 0
                          ? "border-blue-100 bg-white text-[#0B2A5B]"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < purchaseFlow.length - 1 && (
                    <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-[#38A3FF]" />
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <PackageCheck className="h-4 w-4 text-emerald-500" />
              Une réception de marchandise met automatiquement à jour le stock et crée l&apos;entrée en trésorerie prévisionnelle.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
