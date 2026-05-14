"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
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

export function ModuleAdminClient({
  modules,
  enabledKeys: initialEnabled,
  freeKeys,
  organizationId,
}: {
  modules: ModuleInfo[];
  enabledKeys: string[];
  freeKeys: string[];
  organizationId: string;
}) {
  const [enabledKeys, setEnabledKeys] = useState<string[]>(initialEnabled);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleModule(moduleKey: string) {
    setSaving(moduleKey);
    const newEnabled = enabledKeys.includes(moduleKey)
      ? enabledKeys.filter((k) => k !== moduleKey)
      : [...enabledKeys, moduleKey];

    // Optimistic update
    setEnabledKeys(newEnabled);

    try {
      const res = await fetch("/api/modules/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          moduleKey,
          enabled: newEnabled.includes(moduleKey),
        }),
      });
      if (!res.ok) {
        // Revert on error
        setEnabledKeys(enabledKeys);
      }
    } catch {
      setEnabledKeys(enabledKeys);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {modules.map((mod) => {
        const isFree = freeKeys.includes(mod.module_key);
        const isEnabled = enabledKeys.includes(mod.module_key);
        const isLoading = saving === mod.module_key;

        return (
          <div
            key={mod.module_key}
            className={cn(
              "flex items-center justify-between rounded-2xl border p-5 transition-all",
              isEnabled
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-[var(--border)] bg-[var(--card)]",
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{mod.name}</h3>
                {isFree && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Gratuit
                  </span>
                )}
              </div>
              {mod.description && (
                <p className="mt-1 text-sm text-[var(--muted)]">{mod.description}</p>
              )}
              <div className="mt-1 flex gap-4 text-xs text-[var(--muted)]">
                <span>{formatPrice(Number(mod.monthly_price))}/mois</span>
                <span>{formatPrice(Number(mod.yearly_price))}/an</span>
              </div>
            </div>
            <button
              type="button"
              disabled={isFree || isLoading}
              onClick={() => toggleModule(mod.module_key)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                isEnabled
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]",
                isFree && "cursor-not-allowed opacity-50",
              )}
              title={isFree ? "Module gratuit toujours activé" : isEnabled ? "Désactiver" : "Activer"}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEnabled ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
