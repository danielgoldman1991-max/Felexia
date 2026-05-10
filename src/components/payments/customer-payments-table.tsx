import Link from "next/link";
import { Eye, Link2, Pencil } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { formatDate } from "@/lib/format";
import type { CustomerPaymentRecord } from "@/lib/payment-types";

export function CustomerPaymentsTable({ rows }: { rows: CustomerPaymentRecord[] }) {
  return (
    <Table>
      <thead>
        <tr><Th>Numero</Th><Th>Client</Th><Th>Date</Th><Th>Modalite</Th><Th>Montant</Th><Th>Affecte</Th><Th>Disponible</Th><Th>Statut</Th><Th>Reference</Th><Th>Actions</Th></tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={10} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">Aucun paiement client.</td></tr>
        ) : rows.map((payment) => (
          <tr key={payment.id}>
            <Td className="font-medium">{payment.payment_number}</Td>
            <Td>{payment.customer_name}</Td>
            <Td>{formatDate(payment.payment_date)}</Td>
            <Td>{getPaymentMethodLabel(payment.payment_method) ?? payment.payment_method}</Td>
            <Td><MoneyDisplay value={payment.amount} /></Td>
            <Td><MoneyDisplay value={payment.allocated_amount} /></Td>
            <Td><MoneyDisplay value={payment.available_amount} /></Td>
            <Td><PaymentStatusBadge status={payment.status} /></Td>
            <Td>{payment.reference ?? payment.transfer_reference ?? payment.check_number ?? "-"}</Td>
            <Td>
              <div className="flex gap-1">
                <Link href={`/facturation/paiements/${payment.id}`}><Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Voir"><Eye className="h-4 w-4" /></Button></Link>
                {payment.available_amount > 0 && payment.status !== "cancelled" ? <Link href={`/facturation/paiements/${payment.id}/affecter`}><Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Affecter"><Link2 className="h-4 w-4" /></Button></Link> : null}
                {payment.allocated_amount <= 0 && payment.status !== "cancelled" ? <Link href={`/facturation/paiements/${payment.id}/edit`}><Button type="button" className="h-9 w-9 px-0" variant="ghost" title="Modifier"><Pencil className="h-4 w-4" /></Button></Link> : null}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
