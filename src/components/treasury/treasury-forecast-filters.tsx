"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { X } from "lucide-react";
import type { TreasuryAccountRecord } from "@/lib/treasury-types";
import type { TreasuryForecastScenario } from "@/lib/treasury/treasury-forecast";

const SCENARIO_LABELS: Record<TreasuryForecastScenario, string> = {
  prudent: "Prudent",
  realistic: "Realiste",
  optimistic: "Optimiste",
};

export function TreasuryForecastFilters({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  function reset() {
    router.push(pathname);
  }

  const hasFilters = Array.from(sp.entries()).some(([key]) => key !== "created");

  return (
    <div className="mb-6 space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Periode</label>
          <Select value={sp.get("periode") ?? "30"} onChange={(e) => setParam("periode", e.target.value)}>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="60">60 jours</option>
            <option value="90">90 jours</option>
            <option value="custom">Personnalisee</option>
          </Select>
        </div>
        {sp.get("periode") === "custom" ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Du</label>
              <input
                type="date"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
                value={sp.get("from") ?? ""}
                onChange={(e) => setParam("from", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Au</label>
              <input
                type="date"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
                value={sp.get("to") ?? ""}
                onChange={(e) => setParam("to", e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Scenario</label>
          <Select value={sp.get("scenario") ?? "realistic"} onChange={(e) => setParam("scenario", e.target.value)}>
            {Object.entries(SCENARIO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Compte</label>
          <Select value={sp.get("account") ?? ""} onChange={(e) => setParam("account", e.target.value)}>
            <option value="">Tous les comptes</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Type de flux</label>
          <Select value={sp.get("type") ?? "all"} onChange={(e) => setParam("type", e.target.value)}>
            <option value="all">Tous</option>
            <option value="inflow">Encaissements</option>
            <option value="outflow">Decaissements</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Retards</label>
          <Select value={sp.get("overdue") ?? "1"} onChange={(e) => setParam("overdue", e.target.value)}>
            <option value="1">Inclus</option>
            <option value="0">Exclus</option>
          </Select>
        </div>
      </div>
      {hasFilters ? (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={reset}><X className="h-4 w-4" /> Reinitialiser</Button>
        </div>
      ) : null}
    </div>
  );
}
