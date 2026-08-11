"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  acceptSalesQuote,
  archiveSalesQuote,
  convertQuoteToOrder,
  rejectSalesQuote,
  sendSalesQuote,
} from "@/lib/commerce-actions";
import type { CommerceActionResult, SalesQuoteLineRecord, SalesQuoteRecord } from "@/lib/commerce-types";
import { QUOTE_STATUS_LABELS } from "@/lib/commerce-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

function convertAction(prev: CommerceActionResult, formData: FormData) {
  const quoteId = formData.get("quote_id") as string;
  const newForm = new FormData();
  newForm.set("quote_id", quoteId);
  return convertQuoteToOrder(prev, newForm);
}

export function SalesQuoteDetail({ quote, lines }: { quote: SalesQuoteRecord; lines: SalesQuoteLineRecord[] }) {
  const [sendState, sendAction] = useActionState(sendSalesQuote, { success: true });
  const [acceptState, acceptAction] = useActionState(acceptSalesQuote, { success: true });
  const [rejectState, rejectAction] = useActionState(rejectSalesQuote, { success: true });
  const [archiveState, archiveAction] = useActionState(archiveSalesQuote, { success: true });
  const [convertState, convertActionFn] = useActionState(convertAction, { success: true });

  const isDraft = quote.status === "draft";
  const isSent = quote.status === "sent";
  const isAccepted = quote.status === "accepted";
  const canConvert = isDraft || isSent || isAccepted;

  const totalHt = lines.reduce((s, l) => s + l.subtotal_ht, 0);
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const totalTtc = lines.reduce((s, l) => s + l.total_ttc, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Devis ${quote.number ?? "(sans numero)"}`}
        description={quote.customer_name ?? ""}
        actions={
          <>
            {isDraft ? (
              <>
                <Button variant="secondary" asChild><Link href={`/devis/${quote.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
                <form action={sendAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <Button><Send className="h-4 w-4" /> Envoyer</Button>
                  {!sendState.success && sendState.error ? <p className="text-xs text-red-600">{sendState.error}</p> : null}
                </form>
                <form action={archiveAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
                  {!archiveState.success && archiveState.error ? <p className="text-xs text-red-600">{archiveState.error}</p> : null}
                </form>
              </>
            ) : null}
            {isSent ? (
              <>
                <Button variant="secondary" asChild><Link href={`/devis/${quote.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
                <form action={acceptAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <Button><CheckCircle2 className="h-4 w-4" /> Accepter</Button>
                  {!acceptState.success && acceptState.error ? <p className="text-xs text-red-600">{acceptState.error}</p> : null}
                </form>
                <form action={rejectAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <Button variant="danger"><XCircle className="h-4 w-4" /> Rejeter</Button>
                  {!rejectState.success && rejectState.error ? <p className="text-xs text-red-600">{rejectState.error}</p> : null}
                </form>
              </>
            ) : null}
            {canConvert ? (
              <form action={convertActionFn}>
                <input type="hidden" name="quote_id" value={quote.id} />
                <Button variant="secondary">Convertir en commande</Button>
                {!convertState.success && convertState.error ? <p className="text-xs text-red-600">{convertState.error}</p> : null}
              </form>
            ) : null}
            {isAccepted ? (
              <Button variant="secondary" asChild><Link href={`/devis/${quote.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StatusBadge status={quote.status} />
          <span className="text-sm text-[var(--muted)]">
            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
          </span>
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(quote.created_at)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Client" value={quote.customer_name} />
            <Info label="Ville" value={quote.customer_city} />
            <Info label="Date" value={formatDate(quote.document_date)} />
            <Info label="Valide jusqu au" value={quote.valid_until ? formatDate(quote.valid_until) : null} />
            <Info label="Delai paiement" value={`${quote.payment_terms_days} jours`} />
            <Info label="Monnaie" value={quote.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes du devis</h2></CardHeader>
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
              {lines.length > 0 ? (
                lines.map((line, idx) => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="border-t border-[var(--border)] px-4 py-8">
                    <EmptyState
                      title="Aucune ligne de devis"
                      description="Ce devis ne contient pas encore de lignes commerciales."
                    />
                  </td>
                </tr>
              )}
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

      {quote.notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{quote.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {quote.internal_notes ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Notes internes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{quote.internal_notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
