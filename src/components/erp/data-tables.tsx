import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { CashTransaction, DocumentRow, Product, ThirdParty } from "@/lib/types";

export function ThirdPartyTable({ rows }: { rows: ThirdParty[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Nom</Th>
          <Th>Type</Th>
          <Th>ICE</Th>
          <Th>Ville</Th>
          <Th>Solde</Th>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link href={`/tiers/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.name}
              </Link>
              <p className="text-xs text-[var(--muted)]">{row.email}</p>
            </Td>
            <Td>{row.type}</Td>
            <Td className="font-mono text-xs">{row.ice}</Td>
            <Td>{row.city}</Td>
            <Td>
              <MoneyDisplay value={row.balance} />
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

export function ProductTable({ rows }: { rows: Product[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>SKU</Th>
          <Th>Article</Th>
          <Th>Categorie</Th>
          <Th>Prix vente</Th>
          <Th>TVA</Th>
          <Th>Stock</Th>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-mono text-xs">{row.sku}</Td>
            <Td>
              <Link href={`/articles/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.name}
              </Link>
              <p className="text-xs text-[var(--muted)]">{row.type}</p>
            </Td>
            <Td>{row.category}</Td>
            <Td>
              <MoneyDisplay value={row.salePrice} />
            </Td>
            <Td>{row.taxRate}%</Td>
            <Td className={row.stock <= row.minStock && row.type === "product" ? "font-semibold text-[var(--danger)]" : ""}>
              {row.type === "service" ? "-" : `${row.stock} ${row.unit}`}
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

export function DocumentTable({ rows, basePath }: { rows: DocumentRow[]; basePath: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Numero</Th>
          <Th>Tiers</Th>
          <Th>Date</Th>
          <Th>Echeance</Th>
          <Th>Montant</Th>
          <Th>Paye</Th>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>
              <Link href={`${basePath}/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                {row.number}
              </Link>
            </Td>
            <Td>{row.customer}</Td>
            <Td>{formatDate(row.documentDate)}</Td>
            <Td>{row.dueDate ? formatDate(row.dueDate) : "-"}</Td>
            <Td>
              <MoneyDisplay value={row.total} />
            </Td>
            <Td>{row.paid === undefined ? "-" : <MoneyDisplay value={row.paid} />}</Td>
            <Td>
              <StatusBadge status={row.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function CashTable({ rows }: { rows: CashTransaction[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Compte</Th>
          <Th>Operation</Th>
          <Th>Type</Th>
          <Th>Montant</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{formatDate(row.date)}</Td>
            <Td>{row.account}</Td>
            <Td>{row.label}</Td>
            <Td>{row.type === "in" ? "Encaissement" : "Decaissement"}</Td>
            <Td className={row.type === "in" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
              <MoneyDisplay value={row.amount} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
