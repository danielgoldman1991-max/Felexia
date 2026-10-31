import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ThirdPartyFilters, ThirdPartyKind } from "@/lib/third-party-types";

export function ThirdPartyFilters({
  filters,
  forcedType,
  fullAccess = false,
}: {
  filters: ThirdPartyFilters;
  forcedType?: ThirdPartyKind;
  fullAccess?: boolean;
}) {
  return (
    <form role="search" aria-label="Filtrer les contacts" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:flex-wrap sm:items-center">
      <input type="hidden" name="page" value="1" />
      <div className="relative min-w-0 sm:min-w-64 sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          name="q"
          defaultValue={filters.query}
          className="pl-9"
          aria-label="Rechercher un contact"
          placeholder={fullAccess ? "Nom, code, ICE, téléphone, email…" : "Rechercher par nom, email ou téléphone…"}
        />
      </div>
      {forcedType || !fullAccess ? null : (
        <Select name="type" defaultValue={filters.type ?? "all"} aria-label="Type de contact" className="sm:w-40">
          <option value="all">Tous les types</option>
          <option value="prospect">Prospect</option>
          <option value="customer">Client</option>
          <option value="supplier">Fournisseur</option>
        </Select>
      )}
      {fullAccess ? <Input name="city" defaultValue={filters.city} placeholder="Ville" aria-label="Ville" className="sm:w-40" /> : null}
      <Select name="status" defaultValue={filters.status ?? "active"} aria-label="Statut du contact" className="sm:w-44">
        <option value="active">Contacts actifs</option>
        <option value="inactive">Contacts inactifs</option>
        <option value="blocked">Contacts bloqués</option>
        <option value="archived">Contacts archivés</option>
        <option value="all">Tous les statuts</option>
      </Select>
      {fullAccess ? <Select name="vat" defaultValue={filters.vat ?? "all"} aria-label="Assujettissement à la TVA" className="sm:w-44">
        <option value="all">TVA : tous</option>
        <option value="yes">Assujettis à la TVA</option>
        <option value="no">Non assujettis</option>
      </Select> : null}
      <Button type="submit" variant="secondary">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Appliquer
      </Button>
    </form>
  );
}
