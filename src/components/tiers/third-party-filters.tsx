import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ThirdPartyFilters, ThirdPartyKind } from "@/lib/third-party-types";

export function ThirdPartyFilters({
  filters,
  forcedType,
}: {
  filters: ThirdPartyFilters;
  forcedType?: ThirdPartyKind;
}) {
  return (
    <form className="mb-5 grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
      <input type="hidden" name="page" value="1" />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          name="q"
          defaultValue={filters.query}
          className="pl-9"
          placeholder="Nom, code, ICE, telephone, email, ville"
        />
      </div>
      {forcedType ? null : (
        <Select name="type" defaultValue={filters.type ?? "all"}>
          <option value="all">Tous les types</option>
          <option value="prospect">Prospect</option>
          <option value="customer">Client</option>
          <option value="supplier">Fournisseur</option>
        </Select>
      )}
      <Input name="city" defaultValue={filters.city} placeholder="Ville" />
      <Select name="status" defaultValue={filters.status ?? "active"}>
        <option value="active">Actif</option>
        <option value="inactive">Inactif</option>
        <option value="blocked">Bloque</option>
        <option value="archived">Archive</option>
        <option value="all">Tous statuts</option>
      </Select>
      <Select name="vat" defaultValue={filters.vat ?? "all"}>
        <option value="all">TVA: tous</option>
        <option value="yes">Assujetti TVA</option>
        <option value="no">Non assujetti</option>
      </Select>
      <Button type="submit" className="lg:col-start-5">
        Filtrer
      </Button>
    </form>
  );
}
