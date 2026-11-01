import Link from "next/link";
import { Layers } from "lucide-react";

// Subscription changes are prepared from the administrator's billing page.
export function ModuleUpgradePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Layers className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-950">
          Passez à la gestion complète avec PRO
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Retrouvez les ventes avancées, le stock, la comptabilité, la TVA
          et les ressources humaines dans l’offre PRO.
        </p>
        <Link
          href="/parametres/abonnement?plan=pro"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] transition hover:brightness-110"
        >
          Découvrir PRO
        </Link>
      </div>
    </div>
  );
}
