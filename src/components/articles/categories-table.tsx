"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveProductCategory } from "@/lib/product-actions";
import type { ProductCategory } from "@/lib/product-types";
import { formatDate } from "@/lib/format";

const typeLabels: Record<string, string> = {
  product: "Produit",
  service: "Service",
  mixed: "Mixte",
};

export function CategoriesTable({ rows }: { rows: ProductCategory[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nom</Th>
          <Th>Type</Th>
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
              Aucune categorie trouvee.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <CategoryRow key={row.id} category={row} />
        ))}
      </tbody>
    </Table>
  );
}

function CategoryRow({ category }: { category: ProductCategory }) {
  const [archiveState, archiveAction] = useActionState(archiveProductCategory, { success: true });

  return (
    <tr>
      <Td className="font-medium">{category.name}</Td>
      <Td>{typeLabels[category.type] ?? category.type}</Td>
      <Td className="text-[var(--muted)]">{category.description ?? "-"}</Td>
      <Td><StatusBadge status={category.status} /></Td>
      <Td className="text-xs text-[var(--muted)]">{formatDate(category.created_at)}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link href={`/articles/categories/${category.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link></Button>
          <form action={archiveAction}>
            <input type="hidden" name="id" value={category.id} />
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
