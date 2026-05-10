"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Printer, Send, XCircle } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { ReminderStatusBadge } from "@/components/reminders/reminder-status-badge";
import { cancelCustomerReminder, markReminderAsSent } from "@/lib/reminder-actions";
import { formatDate } from "@/lib/format";
import { REMINDER_CHANNEL_LABELS, type CustomerReminderInvoiceRecord, type CustomerReminderRecord, type ReminderActionResult } from "@/lib/reminder-types";

function actionWithId(action: (prev: ReminderActionResult, formData: FormData) => Promise<ReminderActionResult>, id: string) {
  return (prev: ReminderActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function ActionForm({ label, action, icon, variant = "secondary" }: { label: string; action: (prev: ReminderActionResult) => Promise<ReminderActionResult>; icon?: React.ReactNode; variant?: "secondary" | "danger" }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return <form action={formAction} className="inline-flex flex-col gap-1"><Button variant={variant} disabled={pending}>{icon}{label}</Button>{!state.success && state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}</form>;
}

export function CustomerReminderDetail({ reminder, invoices }: { reminder: CustomerReminderRecord; invoices: CustomerReminderInvoiceRecord[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Relance ${reminder.reminder_number}`}
        description={reminder.customer_name ?? ""}
        actions={(
          <>
            <Link href={`/facturation/relances/${reminder.id}/print`} target="_blank"><Button type="button" variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button></Link>
            {reminder.status === "draft" ? <ActionForm label="Marquer envoyee" icon={<Send className="h-4 w-4" />} action={actionWithId(markReminderAsSent, reminder.id)} /> : null}
            {reminder.status !== "cancelled" ? <ActionForm label="Annuler" icon={<XCircle className="h-4 w-4" />} variant="danger" action={actionWithId(cancelCustomerReminder, reminder.id)} /> : null}
          </>
        )}
      />
      <Card><CardContent className="flex flex-wrap items-center gap-3"><ReminderStatusBadge status={reminder.status} /><span>Niveau {reminder.reminder_level}</span><span>{reminder.channel ? REMINDER_CHANNEL_LABELS[reminder.channel] : "-"}</span></CardContent></Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs text-[var(--muted)]">Client</p><p>{reminder.customer_name ?? "-"}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Date relance</p><p>{formatDate(reminder.reminder_date)}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Montant du</p><p><MoneyDisplay value={reminder.total_due_amount} /></p></div>
          <div><p className="text-xs text-[var(--muted)]">Montant en retard</p><p><MoneyDisplay value={reminder.total_overdue_amount} /></p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Factures relancees</h2></CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Facture</Th><Th>Date</Th><Th>Echeance</Th><Th>Retard</Th><Th>Total TTC</Th><Th>Paye</Th><Th>Reste</Th></tr></thead>
            <tbody>{invoices.map((invoice) => <tr key={invoice.id}><Td>{invoice.invoice_number}</Td><Td>{invoice.invoice_date ? formatDate(invoice.invoice_date) : "-"}</Td><Td>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</Td><Td>{invoice.days_overdue ?? 0} j</Td><Td><MoneyDisplay value={invoice.total_ttc} /></Td><Td><MoneyDisplay value={invoice.paid_amount} /></Td><Td><MoneyDisplay value={invoice.remaining_amount} /></Td></tr>)}</tbody>
          </Table>
        </CardContent>
      </Card>
      <Card><CardHeader><h2 className="font-semibold">Message</h2></CardHeader><CardContent className="space-y-3"><p className="font-medium">{reminder.subject}</p><p className="whitespace-pre-line text-sm leading-6">{reminder.message}</p>{reminder.internal_notes ? <p className="text-sm text-[var(--muted)]">{reminder.internal_notes}</p> : null}</CardContent></Card>
    </div>
  );
}
