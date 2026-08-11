import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AccountingJournalEntryFilters, ChartOfAccountOption } from "@/lib/accounting-types";

export function AccountingJournalFilters({
  journalId,
  filters,
  accounts,
}: {
  journalId: string;
  filters: AccountingJournalEntryFilters;
  accounts: ChartOfAccountOption[];
}) {
  return (
    <Card>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Date debut</label>
            <input name="date_from" type="date" defaultValue={filters.date_from ?? ""} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Date fin</label>
            <input name="date_to" type="date" defaultValue={filters.date_to ?? ""} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Statut</label>
            <select name="status" defaultValue={filters.status ?? "all"} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm">
              <option value="all">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="posted">Comptabilisee</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Source</label>
            <select name="source_type" defaultValue={filters.source_type ?? "all"} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm">
              <option value="all">Toutes</option>
              <option value="customer_invoice">Facture client</option>
              <option value="supplier_invoice">Facture fournisseur</option>
              <option value="customer_payment">Paiement client</option>
              <option value="supplier_payment">Paiement fournisseur</option>
              <option value="credit_note">Avoir client</option>
              <option value="manual">Manuel</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Compte comptable</label>
            <select name="account_id" defaultValue={filters.account_id ?? ""} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm">
              <option value="">Tous les comptes</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.account_number} - {account.account_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)]">Tiers</label>
            <input name="third_party_id" defaultValue={filters.third_party_id ?? ""} placeholder="Filtre tiers a venir" className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm" />
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs font-medium text-[var(--muted)]">Recherche</label>
            <input name="q" defaultValue={filters.q ?? ""} placeholder="N ecriture, libelle, compte, source..." className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm" />
          </div>
          <div className="flex items-end gap-2 xl:col-span-4">
            <Button type="submit">Appliquer</Button>
            <Button type="button" variant="secondary" asChild><Link href={`/comptabilite/journaux/${journalId}`}>Reinitialiser</Link></Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
