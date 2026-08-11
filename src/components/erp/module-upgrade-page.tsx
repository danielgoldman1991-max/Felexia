import Link from "next/link";
import { Clock } from "lucide-react";

// Page de verrouillage neutre : Business / Premium ne sont plus commercialisés,
// on ne propose donc plus d'upgrade. Les modules non inclus dans l'offre
// Essentiel sont simplement annoncés comme bientôt disponibles.
export function ModuleUpgradePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-950">
          Fonctionnalité bientôt disponible
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ce module fait partie de la feuille de route FelexiaERP. Il sera
          disponible prochainement dans votre espace.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] transition hover:brightness-110"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
