"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { BookOpen, CheckCircle2, Pencil, Printer, RotateCcw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatDocumentMoney } from "@/lib/print-format";
import { roundInvoice2 } from "@/lib/invoice-calculations";
import { validateSupplierCreditNote, cancelSupplierCreditNote, applySupplierCreditNote, unapplySupplierCreditNote, postSupplierCreditNoteToAccounting } from "@/lib/supplier-credit-note-actions";
import { SUPPLIER_CREDIT_NOTE_STATUS_LABELS, type SupplierCreditNoteActionResult, type SupplierCreditNoteRecord, type SupplierCreditNoteLineRecord, type SupplierCreditNoteApplicationRecord } from "@/lib/supplier-credit-note-types";

type Action = (previous: SupplierCreditNoteActionResult, form: FormData) => Promise<SupplierCreditNoteActionResult>;
type OpenInvoice = { id: string; invoice_number: string; supplier_invoice_number: string | null; invoice_date: string; remaining_amount: number; total_ttc: number };
type AccountingEntry = { entry: { id: string; entry_number: string; status: string }; lines: unknown[] } | null;

function ActionForm({ label, action, id, field = "id", icon, danger = false }: { label: string; action: Action; id: string; field?: string; icon?: ReactNode; danger?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return <form action={formAction} className="inline-flex flex-col gap-2" onSubmit={event => { if (danger && !window.confirm("Annuler cet avoir fournisseur ? Les documents déjà comptabilisés ne peuvent pas être annulés ici.")) event.preventDefault(); }}>
    <input type="hidden" name={field} value={id} /><Button type="submit" variant={danger ? "danger" : "secondary"} disabled={pending}>{icon}{pending ? "Traitement…" : label}</Button>
    {!state.success && state.error ? <p role="alert" className="max-w-sm text-sm text-red-700">{state.error}</p> : null}
  </form>;
}

function ApplicationForm({ creditNote, invoices }: { creditNote: SupplierCreditNoteRecord; invoices: OpenInvoice[] }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState(async (previous: SupplierCreditNoteActionResult, data: FormData) => {
    const result = await applySupplierCreditNote(previous, data);
    if (result.success) setAmounts({});
    return result;
  }, { success: true });
  const applications = useMemo(() => Object.entries(amounts).map(([invoice_id, amount]) => ({ invoice_id, amount: roundInvoice2(amount) })).filter(row => row.amount > 0), [amounts]);
  const total = roundInvoice2(applications.reduce((sum, row) => sum + row.amount, 0));
  const money = (value: number) => formatDocumentMoney(value, creditNote.currency);
  return <Card><CardHeader><h2 className="font-semibold">Affecter aux factures à payer</h2><p className="text-sm text-[var(--muted)]">L’affectation réduit le reste à payer de la facture, sans mouvement bancaire.</p></CardHeader><CardContent>
    {!invoices.length ? <p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">Aucune facture ouverte pour ce fournisseur. L’avoir reste disponible pour une prochaine facture.</p> : <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={creditNote.id} /><input type="hidden" name="applications" value={JSON.stringify(applications)} />
      <Table><thead><tr><Th>Facture</Th><Th>Date</Th><Th className="text-right">Reste à payer</Th><Th>Montant à affecter</Th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id}><Td><Link href={`/achats/factures/${invoice.id}`} className="font-medium text-[var(--primary)] hover:underline">{invoice.invoice_number}</Link>{invoice.supplier_invoice_number ? <p className="mt-1 text-xs text-[var(--muted)]">{invoice.supplier_invoice_number}</p> : null}</Td><Td>{formatDate(invoice.invoice_date)}</Td><Td className="text-right font-mono tabular-nums">{money(invoice.remaining_amount)}</Td><Td><Input aria-label={`Affecter à ${invoice.invoice_number}`} className="max-w-40" type="number" min="0" step="0.01" max={Math.min(invoice.remaining_amount, creditNote.available_amount)} value={amounts[invoice.id] ?? ""} onChange={event => setAmounts(current => ({ ...current, [invoice.id]: Number(event.target.value || 0) }))} /></Td></tr>)}</tbody></Table>
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm">Disponible : <strong>{money(creditNote.available_amount)}</strong> · À affecter : <strong>{money(total)}</strong></p><Button type="submit" disabled={pending || total <= 0 || total > creditNote.available_amount}>{pending ? "Affectation…" : "Affecter l’avoir"}</Button></div>
      {total > creditNote.available_amount ? <p role="alert" className="text-sm text-red-700">Le total ne peut pas dépasser le montant disponible.</p> : null}
      {!state.success && state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
    </form>}
  </CardContent></Card>;
}

export function SupplierCreditNoteDetail({ creditNote, lines, applications, openInvoices, accountingEntry, canWrite, canPost }: {
  creditNote: SupplierCreditNoteRecord; lines: SupplierCreditNoteLineRecord[]; applications: SupplierCreditNoteApplicationRecord[]; openInvoices: OpenInvoice[];
  accountingEntry: AccountingEntry; canWrite: boolean; canPost: boolean;
}) {
  const money = (value: number) => formatDocumentMoney(value, creditNote.currency);
  const posted = accountingEntry?.entry.status === "posted";
  const canApply = canWrite && !["draft", "cancelled"].includes(creditNote.status);
  return <div className="space-y-6">
    <PageHeader title={`Avoir ${creditNote.credit_note_number}`} description={creditNote.supplier_name ?? "Avoir fournisseur"} actions={<>
      <Button variant="secondary" asChild><Link href={`/achats/avoirs/${creditNote.id}/print`} target="_blank"><Printer className="h-4 w-4" />Imprimer / PDF</Link></Button>
      {canWrite && creditNote.status === "draft" && !posted ? <><Button variant="secondary" asChild><Link href={`/achats/avoirs/${creditNote.id}/edit`}><Pencil className="h-4 w-4" />Modifier</Link></Button><ActionForm action={validateSupplierCreditNote} id={creditNote.id} label="Valider l’avoir" icon={<CheckCircle2 className="h-4 w-4" />} /></> : null}
      {canPost && !posted && !["draft", "cancelled"].includes(creditNote.status) ? <ActionForm action={postSupplierCreditNoteToAccounting} id={creditNote.id} label="Comptabiliser" icon={<BookOpen className="h-4 w-4" />} /> : null}
      {canWrite && !posted && creditNote.status !== "cancelled" && creditNote.applied_amount <= 0 ? <ActionForm action={cancelSupplierCreditNote} id={creditNote.id} label="Annuler l’avoir" icon={<XCircle className="h-4 w-4" />} danger /> : null}
    </>} />
    <Card><CardContent className="flex flex-wrap items-center gap-3"><Badge tone={creditNote.status === "cancelled" ? "danger" : creditNote.status === "draft" ? "neutral" : "info"}>{SUPPLIER_CREDIT_NOTE_STATUS_LABELS[creditNote.status] ?? creditNote.status}</Badge><span className="text-sm">Référence fournisseur : <strong>{creditNote.supplier_credit_note_number}</strong></span>{creditNote.source_invoice_id ? <Link className="text-sm font-medium text-[var(--primary)] underline" href={`/achats/factures/${creditNote.source_invoice_id}`}>Facture source {creditNote.source_invoice_number}</Link> : null}</CardContent></Card>
    {accountingEntry ? <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"><p>Écriture <Link className="font-semibold text-[var(--primary)] underline" href={`/comptabilite/ecritures/${accountingEntry.entry.id}`}>{accountingEntry.entry.entry_number}</Link> · {posted ? "Comptabilisée" : "Brouillon comptable"}</p>{posted ? <p className="mt-2 text-[var(--muted)]">Les montants sont conservés. Une correction comptable passe par une écriture de contrepassation réalisée par l’administrateur.</p> : null}</div> : null}
    <Card><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total TTC", value: money(creditNote.total_ttc) }, { label: "Affecté", value: money(creditNote.applied_amount) }, { label: "Disponible", value: money(creditNote.available_amount) }, { label: "Date", value: formatDate(creditNote.credit_note_date) }].map(item => <div key={item.label}><p className="text-sm text-[var(--muted)]">{item.label}</p><p className="mt-1 text-lg font-semibold">{item.value}</p></div>)}</CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Lignes de l’avoir</h2></CardHeader><CardContent><Table><thead><tr><Th>Désignation</Th><Th className="text-right">Quantité</Th><Th className="text-right">Prix HT</Th><Th className="text-right">Remise</Th><Th className="text-right">TVA</Th><Th className="text-right">Total TTC</Th></tr></thead><tbody>{lines.map(line => <tr key={line.id}><Td>{line.description}</Td><Td className="text-right">{line.quantity}</Td><Td className="text-right">{money(line.unit_price_ht)}</Td><Td className="text-right">{line.discount_rate}%</Td><Td className="text-right">{line.tax_rate}%</Td><Td className="text-right font-semibold">{money(line.total_ttc)}</Td></tr>)}</tbody></Table><p className="mt-4 text-right text-sm text-[var(--muted)]">HT net : {money(creditNote.subtotal_ht)} · TVA : {money(creditNote.tax_total)}</p></CardContent></Card>
    {canApply && creditNote.available_amount > 0 ? <ApplicationForm creditNote={creditNote} invoices={openInvoices} /> : null}
    <Card><CardHeader><h2 className="font-semibold">Affectations</h2></CardHeader><CardContent>{applications.length ? <Table><thead><tr><Th>Facture</Th><Th>Date</Th><Th className="text-right">Montant</Th><Th>État</Th>{canApply ? <Th>Correction</Th> : null}</tr></thead><tbody>{applications.map(application => <tr key={application.id}><Td><Link href={`/achats/factures/${application.invoice_id}`} className="font-medium text-[var(--primary)] hover:underline">{application.invoice_number}</Link></Td><Td>{formatDate(application.application_date)}</Td><Td className="text-right">{money(application.amount)}</Td><Td>{application.cancelled_at ? "Retirée" : "Active"}</Td>{canApply ? <Td>{!application.cancelled_at ? <ActionForm action={unapplySupplierCreditNote} id={application.id} field="application_id" label="Retirer l’affectation" icon={<RotateCcw className="h-4 w-4" />} /> : "—"}</Td> : null}</tr>)}</tbody></Table> : <p className="text-sm text-[var(--muted)]">Cet avoir n’est affecté à aucune facture.</p>}{creditNote.applied_amount > 0 && !posted && canWrite ? <p className="mt-4 text-sm text-[var(--muted)]">Pour annuler cet avoir, retirez d’abord ses affectations.</p> : null}</CardContent></Card>
    {creditNote.reason || creditNote.notes || creditNote.internal_notes ? <Card><CardHeader><h2 className="font-semibold">Motif et notes</h2></CardHeader><CardContent className="space-y-3">{creditNote.reason ? <p>{creditNote.reason}</p> : null}{creditNote.notes ? <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">{creditNote.notes}</p> : null}{creditNote.internal_notes ? <details className="text-sm"><summary className="cursor-pointer font-medium">Notes internes</summary><p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">{creditNote.internal_notes}</p></details> : null}</CardContent></Card> : null}
  </div>;
}
