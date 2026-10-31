import Link from "next/link";
import { ArrowUpRight, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ModulePage } from "@/components/erp/module-page";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { formatDate } from "@/lib/format";
import { listSupplierPayments } from "@/lib/purchases";
import { SUPPLIER_PAYMENT_STATUS_LABELS } from "@/lib/purchase-types";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentsPage() {
  const { rows } = await listSupplierPayments();
  return (
    <ModulePage>
      <PageHeader
        title="Règlements fournisseurs"
        description="Retrouvez les paiements effectués à vos fournisseurs."
        actions={<Button asChild><Link href="/achats/paiements/new"><Plus className="h-4 w-4" aria-hidden="true" />Nouveau règlement</Link></Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="Aucun règlement fournisseur pour le moment" description="Enregistrez un paiement pour suivre le règlement de vos factures d’achat." icon={<ArrowUpRight className="h-6 w-6" />} />
      ) : (
        <Table>
          <thead><tr><Th>Numéro</Th><Th>Fournisseur</Th><Th>Date</Th><Th className="text-right">Montant</Th><Th>Statut</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><Link href={`/achats/paiements/${row.id}`} className="font-semibold text-[var(--primary)] hover:underline">{row.payment_number}</Link></Td>
                <Td>{row.supplier_name ?? "-"}</Td>
                <Td>{formatDate(row.payment_date)}</Td>
                <Td className="text-right tabular-nums"><MoneyDisplay value={row.amount} /></Td>
                <Td>{SUPPLIER_PAYMENT_STATUS_LABELS[row.status] ?? row.status}</Td>
                <Td>
                  <Button type="button" variant="ghost" className="h-9 w-9 px-0" asChild><Link href={`/achats/paiements/${row.id}`} title="Consulter le règlement" aria-label={`Consulter le règlement ${row.payment_number}`}><Eye className="h-4 w-4" /></Link></Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
