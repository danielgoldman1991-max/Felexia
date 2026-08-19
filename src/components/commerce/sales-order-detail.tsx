"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { archiveSalesOrder, confirmSalesOrder } from "@/lib/commerce-actions";
import type { SalesOrderLineRecord, SalesOrderRecord } from "@/lib/commerce-types";
import { ORDER_STATUS_LABELS } from "@/lib/commerce-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

export function SalesOrderDetail({ order, lines }: { order: SalesOrderRecord; lines: SalesOrderLineRecord[] }) {
  const [confirmState, confirmAction] = useActionState(confirmSalesOrder, { success: true });
  const [archiveState, archiveAction] = useActionState(archiveSalesOrder, { success: true });

  const isDraft = order.status === "draft";
  const canCreateDelivery = ["confirmed", "partially_delivered"].includes(order.status);

  const totalHt = lines.reduce((s, l) => s + l.subtotal_ht, 0);
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const totalTtc = lines.reduce((s, l) => s + l.total_ttc, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Commande ${order.number ?? "(sans numero)"}`}
        description={order.customer_name ?? ""}
        actions={
          <>
            {isDraft ? (
              <>
                <Button variant="secondary" asChild><Link href={`/commandes/${order.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
                <form action={confirmAction}>
                  <input type="hidden" name="id" value={order.id} />
                  <Button><CheckCircle2 className="h-4 w-4" /> Confirmer</Button>
                  {!confirmState.success && confirmState.error ? <p className="text-xs text-red-600">{confirmState.error}</p> : null}
                </form>
                <form action={archiveAction}>
                  <input type="hidden" name="id" value={order.id} />
                  <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
                  {!archiveState.success && archiveState.error ? <p className="text-xs text-red-600">{archiveState.error}</p> : null}
                </form>
              </>
            ) : null}
            {canCreateDelivery ? (
              <Button asChild><Link href={`/livraisons/new?order_id=${order.id}`}><Truck className="h-4 w-4" /> Creer livraison</Link></Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-sm text-[var(--muted)]">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(order.created_at)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Client" value={order.customer_name} />
            <Info label="Ville" value={order.customer_city} />
            {order.quote_number ? <Info label="Devis lie" value={order.quote_number} /> : null}
            <Info label="Date" value={formatDate(order.document_date)} />
            <Info label="Livraison prevue" value={order.expected_delivery_date ? formatDate(order.expected_delivery_date) : null} />
            <Info label="Delai paiement" value={`${order.payment_terms_days} jours`} />
            <Info label="Monnaie" value={order.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes de commande</h2></CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Produit</Th>
                <Th>Description</Th>
                <Th>Quantite</Th>
                <Th>Unite</Th>
                <Th>Prix HT</Th>
                <Th>Remise %</Th>
                <Th>Total HT</Th>
                <Th>TVA %</Th>
                <Th>Total TTC</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id}>
                  <Td className="text-xs text-[var(--muted)]">{idx + 1}</Td>
                  <Td>{line.product_name ?? "-"}</Td>
                  <Td>{line.description}</Td>
                  <Td>{line.quantity}</Td>
                  <Td>{line.unit_symbol ?? "-"}</Td>
                  <Td><MoneyDisplay value={line.unit_price_ht} /></Td>
                  <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                  <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                  <Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td>
                  <Td><MoneyDisplay value={line.total_ttc} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Totaux</h2></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Info label="Total HT" value={<MoneyDisplay value={totalHt} />} />
          <Info label="Total TVA" value={<MoneyDisplay value={totalTax} />} />
          <Info label="Total TTC" value={<span className="font-semibold"><MoneyDisplay value={totalTtc} /></span>} />
        </CardContent>
      </Card>

      {order.notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{order.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {order.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes internes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{order.internal_notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
