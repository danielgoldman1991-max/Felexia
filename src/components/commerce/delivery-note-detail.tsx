"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { archiveDeliveryNote, markDeliveryAsDelivered, validateDeliveryNote } from "@/lib/commerce-actions";
import type { DeliveryNoteLineRecord, DeliveryNoteRecord } from "@/lib/commerce-types";
import { DELIVERY_STATUS_LABELS } from "@/lib/commerce-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

export function DeliveryNoteDetail({ delivery, lines }: { delivery: DeliveryNoteRecord; lines: DeliveryNoteLineRecord[] }) {
  const [validateState, validateAction] = useActionState(validateDeliveryNote, { success: true });
  const [deliverState, deliverAction] = useActionState(markDeliveryAsDelivered, { success: true });
  const [archiveState, archiveAction] = useActionState(archiveDeliveryNote, { success: true });

  const isDraft = delivery.status === "draft";
  const isValidated = delivery.status === "validated";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bon de livraison ${delivery.number ?? "(sans numero)"}`}
        description={delivery.customer_name ?? ""}
        actions={
          <>
            {isDraft ? (
              <>
                <Link href={`/livraisons/${delivery.id}/edit`}>
                  <Button variant="secondary"><Pencil className="h-4 w-4" /> Modifier</Button>
                </Link>
                <form action={validateAction}>
                  <input type="hidden" name="id" value={delivery.id} />
                  <Button><CheckCircle2 className="h-4 w-4" /> Valider</Button>
                  {!validateState.success && validateState.error ? <p className="text-xs text-red-600">{validateState.error}</p> : null}
                </form>
                <form action={archiveAction}>
                  <input type="hidden" name="id" value={delivery.id} />
                  <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
                  {!archiveState.success && archiveState.error ? <p className="text-xs text-red-600">{archiveState.error}</p> : null}
                </form>
              </>
            ) : null}
            {isValidated ? (
              <>
                <form action={deliverAction}>
                  <input type="hidden" name="id" value={delivery.id} />
                  <Button><Truck className="h-4 w-4" /> Marquer livre</Button>
                  {!deliverState.success && deliverState.error ? <p className="text-xs text-red-600">{deliverState.error}</p> : null}
                </form>
                <form action={archiveAction}>
                  <input type="hidden" name="id" value={delivery.id} />
                  <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
                  {!archiveState.success && archiveState.error ? <p className="text-xs text-red-600">{archiveState.error}</p> : null}
                </form>
              </>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StatusBadge status={delivery.status} />
          <span className="text-sm text-[var(--muted)]">{DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status}</span>
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(delivery.created_at)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Client" value={delivery.customer_name} />
            <Info label="Commande liee" value={delivery.order_number ?? "-"} />
            <Info label="Date document" value={formatDate(delivery.document_date)} />
            <Info label="Date livraison" value={delivery.delivery_date ? formatDate(delivery.delivery_date) : null} />
            <Info label="Livree le" value={delivery.delivered_at ? formatDate(delivery.delivered_at) : null} />
          </CardContent>
        </Card>
        {delivery.delivery_address ? (
          <Card>
            <CardHeader><h2 className="font-semibold">Adresse de livraison</h2></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{delivery.delivery_address}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes du bon de livraison</h2></CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Produit</Th>
                <Th>Description</Th>
                <Th>Quantite</Th>
                <Th>Unite</Th>
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
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {delivery.notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{delivery.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {delivery.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes internes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{delivery.internal_notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
