"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleInfo } from "@/lib/saas";

function formatPrice(price: number): string {
  if (price === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function ModuleSelector({
  modules,
  selectedKeys,
  onChange,
  variant = "dark",
}: {
  modules: ModuleInfo[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  variant?: "dark" | "light";
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((mod) => {
        const isFree = Number(mod.monthly_price) === 0;
        const isSelected = selectedKeys.includes(mod.module_key);
        return (
          <button
            key={mod.module_key}
            type="button"
            disabled={isFree}
            onClick={() => {
              if (isFree) return;
              onChange(
                isSelected
                  ? selectedKeys.filter((k) => k !== mod.module_key)
                  : [...selectedKeys, mod.module_key],
              );
            }}
            className={cn(
              "relative flex items-start gap-4 rounded-2xl border p-5 text-left shadow-sm transition-all",
              variant === "dark"
                ? isFree
                  ? "border-emerald-500/30 bg-emerald-500/5 opacity-70 cursor-default"
                  : isSelected
                    ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                : isFree
                  ? "border-emerald-300 bg-emerald-50 cursor-default"
                  : isSelected
                    ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                    : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md",
            )}
          >
            {isSelected && !isFree && (
              <span
                className={cn(
                  "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full",
                  variant === "dark" ? "bg-blue-500" : "bg-blue-600",
                )}
              >
                <Check className="h-3 w-3 text-white" />
              </span>
            )}
            {isFree && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-3 w-3 text-emerald-500" />
              </span>
            )}
            <div className="flex-1">
              <h3 className={cn("font-semibold", variant === "dark" ? "text-white" : "text-slate-900")}>
                {mod.name}
              </h3>
              {mod.description && (
                <p className={cn("mt-1 text-sm", variant === "dark" ? "text-white/50" : "text-slate-500")}>
                  {mod.description}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("font-semibold", variant === "dark" ? "text-white" : "text-slate-900")}>
                {formatPrice(Number(mod.monthly_price))}
              </p>
              {!isFree && Number(mod.yearly_price) > 0 && (
                <p className={cn("text-xs", variant === "dark" ? "text-white/40" : "text-slate-400")}>
                  {formatPrice(Number(mod.yearly_price))}/an
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function PriceSummary({
  modules,
  selectedKeys,
  billingInterval,
  onBillingChange,
  onConfirmLabel,
  onConfirm,
  loading,
  variant = "dark",
}: {
  modules: ModuleInfo[];
  selectedKeys: string[];
  billingInterval: "monthly" | "yearly";
  onBillingChange: (interval: "monthly" | "yearly") => void;
  onConfirmLabel?: string;
  onConfirm?: () => void;
  loading?: boolean;
  variant?: "dark" | "light";
}) {
  const total = modules
    .filter((m) => selectedKeys.includes(m.module_key))
    .reduce(
      (sum, m) =>
        sum +
        (billingInterval === "monthly"
          ? Number(m.monthly_price)
          : Number(m.yearly_price)),
      0,
    );

  const freeModules = modules.filter((m) => Number(m.monthly_price) === 0);
  const paidModules = selectedKeys.filter(
    (k) => !freeModules.some((fm) => fm.module_key === k),
  );

  const hasModulesSelected = selectedKeys.length > 0;
  const yearlySavings = (() => {
    const monthlyTotal = modules
      .filter((m) => paidModules.includes(m.module_key))
      .reduce((sum, m) => sum + Number(m.monthly_price) * 12, 0);
    if (monthlyTotal === 0) return 0;
    return Math.round((1 - total / monthlyTotal) * 100);
  })();

  function formatPrice(price: number): string {
    if (price === 0) return "Gratuit";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(price);
  }

  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>
          Récapitulatif
        </h3>
        <div
          className={cn(
            "inline-flex rounded-lg border p-1",
            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-100",
          )}
        >
          <button
            type="button"
            onClick={() => onBillingChange("monthly")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              billingInterval === "monthly"
                ? "bg-blue-600 text-white shadow-sm"
                : isDark
                  ? "text-white/50 hover:text-white"
                  : "text-slate-500 hover:text-slate-900",
            )}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => onBillingChange("yearly")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              billingInterval === "yearly"
                ? "bg-blue-600 text-white shadow-sm"
                : isDark
                  ? "text-white/50 hover:text-white"
                  : "text-slate-500 hover:text-slate-900",
            )}
          >
            Annuel
            {yearlySavings > 0 && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  isDark
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                -{yearlySavings}%
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {modules
          .filter((m) => selectedKeys.includes(m.module_key))
          .map((m) => (
            <div key={m.module_key} className="flex items-center justify-between text-sm">
              <span className={isDark ? "text-white/70" : "text-slate-600"}>{m.name}</span>
              <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                {formatPrice(
                  billingInterval === "monthly"
                    ? Number(m.monthly_price)
                    : Number(m.yearly_price),
                )}
              </span>
            </div>
          ))}
        {!hasModulesSelected && (
          <p className={cn("text-sm", isDark ? "text-white/40" : "text-slate-400")}>
            Sélectionnez des modules ci-dessus
          </p>
        )}
      </div>

      <div className={cn("mt-4 border-t pt-4", isDark ? "border-white/10" : "border-slate-200")}>
        <div className="flex items-center justify-between">
          <span className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>
            {formatPrice(total)}
          </span>
          <span className={cn("text-sm", isDark ? "text-white/50" : "text-slate-500")}>
            {billingInterval === "monthly" ? "/mois" : "/an"}
          </span>
        </div>
        {total === 0 && hasModulesSelected && (
          <p className={cn("mt-2 text-sm", isDark ? "text-emerald-400" : "text-emerald-600")}>
            Version gratuite - tous les modules essentiels inclus
          </p>
        )}
      </div>

      {onConfirm && (
        <button
          type="button"
          disabled={loading || !hasModulesSelected}
          onClick={onConfirm}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Chargement..." : onConfirmLabel || "Commencer l'essai Essentiel"}
        </button>
      )}
    </div>
  );
}
