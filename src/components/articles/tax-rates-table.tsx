"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveTaxRate, setDefaultTaxRate } from "@/lib/product-actions";
import type { TaxRate } from "@/lib/product-types";
import { formatDate } from "@/lib/format";

export function TaxRatesTable({ rows }: { rows: TaxRate[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nom</Th>
          <Th>Taux</Th>
          <Th>Par defaut</Th>
          <Th>Description</Th>
          <Th>Statut</Th>
          <Th>Date de creation</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucun taux TVA trouve.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <TaxRateRow key={row.id} taxRate={row} />
        ))}
      </tbody>
    </Table>
  );
}

function TaxRateRow({ taxRate }: { taxRate: TaxRate }) {
  const [archiveState, archiveAction] = useActionState(archiveTaxRate, { success: true });
  const [defaultState, defaultAction] = useActionState(setDefaultTaxRate, { success: true });

  return (
    <tr>
      <Td className="font-medium">{taxRate.name}</Td>
      <Td className="font-mono text-xs">{taxRate.rate}%</Td>
      <Td>{taxRate.is_default ? <Star className="h-4 w-4 text-[var(--warning)]" /> : "-"}</Td>
      <Td className="text-[var(--muted)]">{taxRate.description ?? "-"}</Td>
      <Td><StatusBadge status={taxRate.status} /></Td>
      <Td className="text-xs text-[var(--muted)]">{formatDate(taxRate.created_at)}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <Link href={`/articles/tva/${taxRate.id}/edit`}>
            <Button variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
          </Link>
          {!taxRate.is_default ? (
            <form action={defaultAction}>
              <input type="hidden" name="id" value={taxRate.id} />
              <Button variant="ghost"><Star className="h-3.5 w-3.5 text-[var(--warning)]" /></Button>
              {!defaultState.success && defaultState.error ? (
                <p className="mt-1 text-xs text-red-600">{defaultState.error}</p>
              ) : null}
            </form>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="id" value={taxRate.id} />
            <Button variant="ghost"><Archive className="h-3.5 w-3.5 text-[var(--danger)]" /></Button>
            {!archiveState.success && archiveState.error ? (
              <p className="mt-1 text-xs text-red-600">{archiveState.error}</p>
            ) : null}
          </form>
        </div>
      </Td>
    </tr>
  );
}
