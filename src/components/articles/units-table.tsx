"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveUnit } from "@/lib/product-actions";
import type { Unit } from "@/lib/product-types";
import { formatDate } from "@/lib/format";

export function UnitsTable({ rows }: { rows: Unit[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nom</Th>
          <Th>Symbole</Th>
          <Th>Description</Th>
          <Th>Statut</Th>
          <Th>Date de creation</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucune unite trouvee.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <UnitRow key={row.id} unit={row} />
        ))}
      </tbody>
    </Table>
  );
}

function UnitRow({ unit }: { unit: Unit }) {
  const [archiveState, archiveAction] = useActionState(archiveUnit, { success: true });

  return (
    <tr>
      <Td className="font-medium">{unit.name}</Td>
      <Td className="font-mono text-xs">{unit.symbol}</Td>
      <Td className="text-[var(--muted)]">{unit.description ?? "-"}</Td>
      <Td><StatusBadge status={unit.status} /></Td>
      <Td className="text-xs text-[var(--muted)]">{formatDate(unit.created_at)}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link href={`/articles/unites/${unit.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link></Button>
          <form action={archiveAction}>
            <input type="hidden" name="id" value={unit.id} />
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
