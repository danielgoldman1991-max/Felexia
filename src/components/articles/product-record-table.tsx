import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { ProductRecord } from "@/lib/product-types";

export function ProductRecordTable({ rows }: { rows: ProductRecord[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>SKU</Th>
          <Th>Article</Th>
          <Th>Categorie</Th>
          <Th>Prix vente HT</Th>
          <Th>TVA</Th>
          <Th>Stock</Th>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Aucun article trouve.
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-mono text-xs">{row.sku ?? "-"}</Td>
            <Td>
              <Link href={`/articles/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.name}
              </Link>
              <p className="text-xs text-[var(--muted)]">{row.type === "product" ? "Produit" : "Service"}</p>
            </Td>
            <Td>{row.category_name ?? "-"}</Td>
            <Td>
              <MoneyDisplay value={row.sale_price_ht} />
            </Td>
            <Td>{row.tax_rate_value != null ? `${row.tax_rate_value}%` : "-"}</Td>
            <Td className={row.current_stock <= row.min_stock && row.type === "product" && row.current_stock > 0 ? "font-semibold text-[var(--danger)]" : ""}>
              {row.type === "service" ? "-" : `${row.current_stock} ${row.unit_symbol ?? ""}`}
            </Td>
            <Td>
              <StatusBadge status={row.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
