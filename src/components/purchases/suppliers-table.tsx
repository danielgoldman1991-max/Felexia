import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";

type SupplierRow = { id: string; name: string; ice: string | null; phone: string | null; email: string | null; city: string | null; status: string };

export function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun fournisseur" description="Les fournisseurs actifs apparaitront ici." />;
  return (
    <Table>
      <thead><tr><Th>Nom</Th><Th>ICE</Th><Th>Telephone</Th><Th>Email</Th><Th>Ville</Th><Th>Statut</Th><Th>Actions</Th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-medium">{row.name}</Td>
            <Td>{row.ice ?? "-"}</Td>
            <Td>{row.phone ?? "-"}</Td>
            <Td>{row.email ?? "-"}</Td>
            <Td>{row.city ?? "-"}</Td>
            <Td>{row.status}</Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" asChild><Link href={`/tiers/${row.id}`}>Voir fiche</Link></Button>
                <Button type="button" variant="ghost" asChild><Link href={`/tiers/${row.id}/edit`}>Modifier</Link></Button>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
