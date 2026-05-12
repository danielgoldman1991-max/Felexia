"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TREASURY_ACCOUNT_TYPE_LABELS, TREASURY_TRANSACTION_TYPE_LABELS, RECONCILIATION_STATUS_LABELS, type TreasuryAccountRecord } from "@/lib/treasury-types";
import { Search, X } from "lucide-react";

export function TreasuryConsultationFilters({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function reset() {
    router.push(pathname);
  }

  const hasFilters = Array.from(sp.entries()).length > 0;

  return (
    <div className="mb-6 space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Periode du</label>
          <input
            type="date"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            value={sp.get("date_from") ?? ""}
            onChange={(e) => setParam("date_from", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Periode au</label>
          <input
            type="date"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            value={sp.get("date_to") ?? ""}
            onChange={(e) => setParam("date_to", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Compte</label>
          <Select value={sp.get("treasury_account_id") ?? ""} onChange={(e) => setParam("treasury_account_id", e.target.value)}>
            <option value="">Tous les comptes</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Type de compte</label>
          <Select value={sp.get("account_type") ?? ""} onChange={(e) => setParam("account_type", e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(TREASURY_ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Sens</label>
          <Select value={sp.get("direction") ?? ""} onChange={(e) => setParam("direction", e.target.value)}>
            <option value="">Tous</option>
            <option value="in">Entree</option>
            <option value="out">Sortie</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Type de flux</label>
          <Select value={sp.get("transaction_type") ?? ""} onChange={(e) => setParam("transaction_type", e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(TREASURY_TRANSACTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Statut rapprochement</label>
          <Select value={sp.get("reconciliation_status") ?? ""} onChange={(e) => setParam("reconciliation_status", e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(RECONCILIATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Statut comptable</label>
          <Select value={sp.get("accounting_status") ?? ""} onChange={(e) => setParam("accounting_status", e.target.value)}>
            <option value="">Tous</option>
            <option value="posted">Comptabilise</option>
            <option value="not_posted">Non comptabilise</option>
            <option value="not_applicable">Sans ecriture</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Mode de paiement</label>
          <Select value={sp.get("payment_method") ?? ""} onChange={(e) => setParam("payment_method", e.target.value)}>
            <option value="">Tous</option>
            <option value="cash">Especes</option>
            <option value="check">Cheque</option>
            <option value="bank_transfer">Virement</option>
            <option value="bank_card">Carte bancaire</option>
            <option value="mobile_money">Paiement mobile</option>
            <option value="other">Autre</option>
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Recherche</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Libelle, reference, tiers..."
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
              value={sp.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </div>
        </div>
      </div>
      {hasFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={reset}><X className="h-4 w-4" /> Effacer les filtres</Button>
        </div>
      )}
    </div>
  );
}