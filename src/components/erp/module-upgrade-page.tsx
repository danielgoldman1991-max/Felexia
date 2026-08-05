import Link from "next/link";
import { Lock } from "lucide-react";
import { PLAN_LABELS, PLAN_KEYS, type PlanKey } from "@/lib/subscriptions/plans-config";

const PLAN_REQUIRED_FOR_MODULE: Record<string, PlanKey> = {
  purchases: PLAN_KEYS.BUSINESS,
  stock: PLAN_KEYS.BUSINESS,
  treasury: PLAN_KEYS.BUSINESS,
  accounting: PLAN_KEYS.BUSINESS,
  rh: PLAN_KEYS.PREMIUM,
};

export function ModuleUpgradePage({
  moduleKey,
  currentPlanCode,
}: {
  moduleKey: string;
  currentPlanCode: PlanKey;
}) {
  const requiredPlan = PLAN_REQUIRED_FOR_MODULE[moduleKey] ?? PLAN_KEYS.BUSINESS;
  const currentPlanLabel = PLAN_LABELS[currentPlanCode] ?? currentPlanCode;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-950">
          Module disponible dans {PLAN_LABELS[requiredPlan]}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ce module n&apos;est pas inclus dans votre formule {currentPlanLabel}.
        </p>
        <Link
          href="/parametres/abonnement"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-6 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] transition hover:brightness-110"
        >
          Voir les offres
        </Link>
      </div>
    </div>
  );
}