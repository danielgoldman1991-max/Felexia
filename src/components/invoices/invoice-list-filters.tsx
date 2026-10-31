import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function InvoiceListFilters({ params, supplier = false }: { params: Record<string, string | undefined>; supplier?: boolean }) {
  return <form role="search" aria-label={supplier ? "Filtrer les factures fournisseurs" : "Filtrer les factures clients"} className="mb-4 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-3">
    <label className="space-y-1 text-xs font-medium"><span>Rechercher</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted)]" /><Input name="q" defaultValue={params.q} placeholder={`Numéro ou ${supplier ? "fournisseur" : "client"}…`} className="pl-9" /></div></label>
    <label className="space-y-1 text-xs font-medium"><span>Statut</span><Select name="status" defaultValue={params.status || "all"}><option value="all">Tous les statuts</option><option value="draft">Brouillons</option><option value="validated">Validées</option>{!supplier ? <option value="sent">Envoyées</option> : null}<option value="partially_paid">Partiellement réglées</option><option value="paid">Payées</option><option value="cancelled">Annulées</option></Select></label>
    <label className="space-y-1 text-xs font-medium"><span>Règlement</span><Select name="paymentStatus" defaultValue={params.paymentStatus || "all"}><option value="all">Tous les règlements</option><option value="unpaid">Non réglées</option><option value="partial">Partiel</option><option value="paid">Réglées</option></Select></label>
    <label className="space-y-1 text-xs font-medium"><span>Du</span><Input type="date" name="dateFrom" defaultValue={params.dateFrom} /></label>
    <label className="space-y-1 text-xs font-medium"><span>Au</span><Input type="date" name="dateTo" defaultValue={params.dateTo} /></label>
    <Button type="submit" variant="secondary" className="self-end">Appliquer les filtres</Button>
  </form>;
}
