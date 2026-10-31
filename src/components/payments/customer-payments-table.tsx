import Link from "next/link";
import { ArrowDownLeft, Eye, Link2, Pencil } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { formatDate } from "@/lib/format";
import type { CustomerPaymentRecord } from "@/lib/payment-types";

export function CustomerPaymentsTable({ rows }: { rows: CustomerPaymentRecord[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Aucun règlement reçu pour le moment" description="Enregistrez un encaissement client, puis affectez-le à une ou plusieurs factures." icon={<ArrowDownLeft className="h-6 w-6" />} />;
  }

  return (
    <Table>
      <thead>
        <tr><Th>Numéro</Th><Th>Client</Th><Th>Date</Th><Th>Mode de règlement</Th><Th className="text-right">Montant</Th><Th className="text-right">Affecté</Th><Th className="text-right">Disponible</Th><Th>Statut</Th><Th>Référence</Th><Th>Actions</Th></tr>
      </thead>
      <tbody>
        {rows.map((payment) => (
          <tr key={payment.id}>
            <Td><Link href={`/facturation/paiements/${payment.id}`} className="font-semibold text-[var(--primary)] hover:underline">{payment.payment_number}</Link></Td>
            <Td>{payment.customer_name}</Td>
            <Td>{formatDate(payment.payment_date)}</Td>
            <Td>{getPaymentMethodLabel(payment.payment_method) ?? payment.payment_method}</Td>
            <Td className="text-right tabular-nums"><MoneyDisplay value={payment.amount} /></Td>
            <Td className="text-right tabular-nums"><MoneyDisplay value={payment.allocated_amount} /></Td>
            <Td className="text-right tabular-nums"><MoneyDisplay value={payment.available_amount} /></Td>
            <Td><PaymentStatusBadge status={payment.status} /></Td>
            <Td>{payment.reference ?? payment.transfer_reference ?? payment.check_number ?? "-"}</Td>
            <Td>
              <div className="flex gap-1">
                <Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Voir" asChild><Link href={`/facturation/paiements/${payment.id}`}><Eye className="h-4 w-4" /></Link></Button>
                {payment.available_amount > 0 && payment.status !== "cancelled" ? <Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Affecter" asChild><Link href={`/facturation/paiements/${payment.id}/affecter`}><Link2 className="h-4 w-4" /></Link></Button> : null}
                {payment.allocated_amount <= 0 && payment.status !== "cancelled" ? <Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Modifier" asChild><Link href={`/facturation/paiements/${payment.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button> : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
