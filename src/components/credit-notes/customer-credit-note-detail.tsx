"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Link2, Printer, XCircle } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { CreditNoteStatusBadge } from "@/components/credit-notes/credit-note-status-badge";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { cancelCustomerCreditNote, validateCustomerCreditNote } from "@/lib/credit-note-actions";
import { CREDIT_NOTE_SOURCE_LABELS, type CreditNoteActionResult, type CreditNoteApplicationRecord, type CustomerCreditNoteLineRecord, type CustomerCreditNoteRecord } from "@/lib/credit-note-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import { formatDate } from "@/lib/format";

function actionWithId(action: (prev: CreditNoteActionResult, formData: FormData) => Promise<CreditNoteActionResult>, id: string) {
  return (prev: CreditNoteActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function ActionForm({ label, action, icon, variant = "secondary" }: { label: string; action: (prev: CreditNoteActionResult) => Promise<CreditNoteActionResult>; icon?: React.ReactNode; variant?: "secondary" | "danger" }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return <form action={formAction} className="inline-flex flex-col gap-1"><Button variant={variant} disabled={pending}>{icon}{label}</Button>{!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}</form>;
}

export function CustomerCreditNoteDetail({ creditNote, lines, applications, documentFlow }: { creditNote: CustomerCreditNoteRecord; lines: CustomerCreditNoteLineRecord[]; applications: CreditNoteApplicationRecord[]; documentFlow?: DocumentFlowStep[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Avoir ${creditNote.credit_note_number}`}
        description={creditNote.customer_name ?? ""}
        actions={(
          <>
            <Link href={`/facturation/avoirs/${creditNote.id}/print`} target="_blank"><Button type="button" variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button></Link>
            {creditNote.available_amount > 0 ? <Link href={`/facturation/avoirs/${creditNote.id}/affecter`}><Button type="button" variant="secondary"><Link2 className="h-4 w-4" /> Affecter</Button></Link> : null}
            {creditNote.status === "draft" ? <ActionForm label="Valider" icon={<CheckCircle2 className="h-4 w-4" />} action={actionWithId(validateCustomerCreditNote, creditNote.id)} /> : null}
            {creditNote.status !== "cancelled" ? <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelCustomerCreditNote, creditNote.id)} /> : null}
          </>
        )}
      />
      <DocumentFlowMap steps={documentFlow ?? []} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <CreditNoteStatusBadge status={creditNote.status} />
          <span>{CREDIT_NOTE_SOURCE_LABELS[creditNote.source_type]}</span>
          {creditNote.source_return_id && creditNote.source_return_number ? (
            <Link className="font-medium text-[var(--secondary)] hover:text-[var(--primary)]" href={`/vente/retours/${creditNote.source_return_id}`}>
              Origine : Bon de retour {creditNote.source_return_number}
            </Link>
          ) : null}
          {creditNote.source_invoice_number ? <span>Facture source : {creditNote.source_invoice_number}</span> : null}
        </CardContent>
      </Card>
      <Card><CardHeader><h2 className="font-semibold">Montants</h2></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><div>Total TTC<br /><strong><MoneyDisplay value={creditNote.total_ttc} /></strong></div><div>Utilise<br /><strong><MoneyDisplay value={creditNote.applied_amount} /></strong></div><div>Disponible<br /><strong><MoneyDisplay value={creditNote.available_amount} /></strong></div><div>Date<br /><strong>{formatDate(creditNote.credit_note_date)}</strong></div></CardContent></Card>
      <Card><CardHeader><h2 className="font-semibold">Lignes</h2></CardHeader><CardContent><Table><thead><tr><Th>#</Th><Th>Produit</Th><Th>Description</Th><Th>Quantite</Th><Th>Prix HT</Th><Th>TVA</Th><Th>Total TTC</Th></tr></thead><tbody>{lines.map((line, index) => <tr key={line.id}><Td>{index + 1}</Td><Td>{line.product_name ?? "Ligne libre"}</Td><Td>{line.description}</Td><Td>{line.quantity}</Td><Td><MoneyDisplay value={line.unit_price_ht} /></Td><Td>{line.tax_rate}%</Td><Td><MoneyDisplay value={line.total_ttc} /></Td></tr>)}</tbody></Table></CardContent></Card>
      <Card><CardHeader><h2 className="font-semibold">Affectations</h2></CardHeader><CardContent>{applications.length === 0 ? <p className="text-sm text-[var(--muted)]">Cet avoir n&apos;est affecte a aucune facture.</p> : <Table><thead><tr><Th>Facture</Th><Th>Date</Th><Th>Montant</Th></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><Td>{application.invoice_number}</Td><Td>{formatDate(application.application_date)}</Td><Td><MoneyDisplay value={application.amount} /></Td></tr>)}</tbody></Table>}</CardContent></Card>
      {creditNote.reason || creditNote.notes ? <Card><CardHeader><h2 className="font-semibold">Motif et notes</h2></CardHeader><CardContent><p>{creditNote.reason}</p><p className="text-sm text-[var(--muted)]">{creditNote.notes}</p></CardContent></Card> : null}
    </div>
  );
}
