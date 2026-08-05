"use client";

import { Hourglass, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingOverlayProps = {
  open: boolean;
  title?: string;
  description?: string;
  note?: string;
  steps?: string[];
  className?: string;
};

const defaultSteps = [
  "Création de votre organisation",
  "Configuration de votre espace",
  "Activation de votre essai Essentiel",
  "Finalisation...",
];

export function LoadingOverlay({
  open,
  title = "Création de votre entreprise en cours",
  description = "Merci de patienter quelques instants. Nous préparons votre espace Felexia et activons votre essai Essentiel.",
  note = "Cela peut prendre quelques secondes. Ne fermez pas cette page.",
  steps = defaultSteps,
  className,
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        role="status"
        className={cn(
          "w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 text-center shadow-2xl shadow-slate-950/20",
          className,
        )}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <div className="relative">
            <Hourglass className="h-7 w-7" />
            <LoaderCircle className="absolute -right-3 -top-3 h-5 w-5 animate-spin text-blue-500" />
          </div>
        </div>

        <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-1.5 w-1/2 animate-pulse rounded-full bg-blue-600" />
        </div>

        <ul className="mt-5 space-y-2 text-left">
          {steps.map((step) => (
            <li key={step} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
          {note}
        </p>
      </div>
    </div>
  );
}
