"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerReminder } from "@/lib/reminder-actions";
import type { OverdueInvoiceForReminder, ReminderActionResult, ReminderCustomerOption } from "@/lib/reminder-types";
import { formatDate } from "@/lib/format";

function today() {
  return new Date().toISOString().split("T")[0];
}

function defaultMessage(level: number) {
  if (level === 2) return "Nous constatons que les factures ci-dessous demeurent impayees malgre une precedente relance. Nous vous remercions de regulariser votre situation dans les meilleurs delais.";
  if (level >= 3) return "Nous vous demandons de bien vouloir regulariser votre situation dans les meilleurs delais concernant les factures echues ci-dessous.";
  return "Sauf erreur de notre part, certaines factures arrivees a echeance restent ouvertes a ce jour. Nous vous remercions de bien vouloir proceder a leur reglement.";
}

export function CustomerReminderForm({
  customers,
  invoices,
  initialCustomerId,
  suggestedLevel,
}: {
  customers: ReminderCustomerOption[];
  invoices: OverdueInvoiceForReminder[];
  initialCustomerId: string;
  suggestedLevel: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ReminderActionResult, FormData>(createCustomerReminder, { success: true });
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [level, setLevel] = useState(suggestedLevel);
  const [message, setMessage] = useState(defaultMessage(suggestedLevel));
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(invoices.map((invoice) => [invoice.id, true])));
  const selectedIds = useMemo(() => invoices.filter((invoice) => selected[invoice.id]).map((invoice) => invoice.id), [invoices, selected]);
  const total = invoices.filter((invoice) => selected[invoice.id]).reduce((sum, invoice) => sum + invoice.remaining_amount, 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="invoice_ids" value={JSON.stringify(selectedIds)} />
      <Card>
        <CardHeader><h2 className="font-semibold">Client a relancer</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Client</span>
            <Select
              name="customer_id"
              value={customerId}
              onChange={(event) => {
                const value = event.target.value;
                setCustomerId(value);
                router.push(value ? `/facturation/relances/new?customerId=${value}` : "/facturation/relances/new");
              }}
            >
              <option value="">Selectionner un client</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} - {customer.overdue_invoices_count} facture(s)</option>)}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date relance</span>
            <DateField name="reminder_date" defaultValue={today()} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Niveau</span>
            <Select
              name="reminder_level"
              value={level}
              onChange={(event) => {
                const nextLevel = Number(event.target.value);
                setLevel(nextLevel);
                setMessage(defaultMessage(nextLevel));
              }}
            >
              <option value={1}>Niveau 1 - amiable</option>
              <option value={2}>Niveau 2 - ferme</option>
              <option value={3}>Niveau 3 - mise en demeure commerciale</option>
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Canal</span>
            <Select name="channel" defaultValue="email">
              <option value="email">Email</option>
              <option value="phone">Telephone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="letter">Courrier</option>
              <option value="in_person">En personne</option>
              <option value="other">Autre</option>
            </Select>
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Objet</span>
            <Input name="subject" defaultValue="Relance factures echues" />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Message</span>
            <Textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes internes</span>
            <Textarea name="internal_notes" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Factures echues</h2></CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 ? <p className="text-sm text-[var(--muted)]">Selectionnez un client avec des factures echues depuis la liste.</p> : (
            <Table>
              <thead><tr><Th>Selection</Th><Th>Facture</Th><Th>Date</Th><Th>Echeance</Th><Th>Retard</Th><Th>Reste</Th></tr></thead>
              <tbody>{invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td><input type="checkbox" checked={Boolean(selected[invoice.id])} onChange={(event) => setSelected((current) => ({ ...current, [invoice.id]: event.target.checked }))} /></Td>
                  <Td>{invoice.invoice_number}</Td>
                  <Td>{formatDate(invoice.invoice_date)}</Td>
                  <Td>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</Td>
                  <Td>{invoice.days_overdue} j</Td>
                  <Td><MoneyDisplay value={invoice.remaining_amount} /></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
          <p className="text-sm font-medium">Total selectionne : <MoneyDisplay value={total} /></p>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Link href="/facturation/relances"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending || !customerId || selectedIds.length === 0}>Creer relance</Button>
      </div>
    </form>
  );
}
