import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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
        title="Paiements fournisseurs"
        description="Paiements effectues aux fournisseurs."
        actions={<Button asChild><Link href="/achats/paiements/new"><Plus className="h-4 w-4" /> Nouveau paiement</Link></Button>}
      />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="Aucun paiement" description="Les paiements fournisseurs apparaitront ici." />
          ) : (
            <Table>
              <thead><tr><Th>Numero</Th><Th>Fournisseur</Th><Th>Date</Th><Th>Montant</Th><Th>Statut</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium">{row.payment_number}</Td>
                    <Td>{row.supplier_name ?? "-"}</Td>
                    <Td>{formatDate(row.payment_date)}</Td>
                    <Td><MoneyDisplay value={row.amount} /></Td>
                    <Td>{SUPPLIER_PAYMENT_STATUS_LABELS[row.status] ?? row.status}</Td>
                    <Td>
                      <Button type="button" variant="secondary" asChild><Link href={`/achats/paiements/${row.id}`}>Consulter</Link></Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModulePage>
  );
}
