import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Package,
  Users,
} from "lucide-react";
import { CompleteOnboardingButton } from "@/components/onboarding/complete-onboarding-button";
import type { OnboardingChecklist, OnboardingChecklistStepKey } from "@/lib/onboarding";

const STEP_ICONS: Record<OnboardingChecklistStepKey, typeof Building2> = {
  company: Building2,
  prospect: Users,
  article: Package,
  treasury: Landmark,
  quote: FileText,
  pdf: Download,
};

export function WelcomeChecklist({ checklist }: { checklist: OnboardingChecklist }) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
              Guide de démarrage
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Bienvenue sur Felexia
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Finalisez votre espace {checklist.organizationName} et créez vos premiers documents en quelques minutes.
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-700">
            <p className="text-2xl font-bold">{checklist.completedCount}/{checklist.totalCount}</p>
            <p className="text-xs font-medium">étapes complétées</p>
          </div>
        </div>

        <div className="mt-8">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${checklist.progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">{checklist.progress}% de configuration terminée.</p>
        </div>

        <div className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {checklist.steps.map((step) => {
            const Icon = STEP_ICONS[step.key];
            return (
              <Link
                key={step.key}
                href={step.href}
                className="group flex items-center gap-4 bg-white p-4 transition hover:bg-slate-50 sm:p-5"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${step.completed ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-950">{step.title}</span>
                  <span className="mt-1 block text-sm text-slate-500">{step.description}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition group-hover:bg-white group-hover:text-blue-600">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Vous pouvez revenir à cette page depuis le guide de démarrage.
          </p>
          <div className="flex gap-3">
            <CompleteOnboardingButton />
            <Link
              href="/parametres/entreprise"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Continuer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
