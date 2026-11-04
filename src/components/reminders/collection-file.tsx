"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { whatsAppLink } from "@/lib/sales/collection";
import { approveCollectionItem, saveCollectionExclusion, saveCollectionSettings, savePaymentPromise } from "@/lib/sales/collection-actions";
import type { CollectionQueueItem } from "@/lib/sales/collection";
import type { ReminderActionResult } from "@/lib/reminder-types";

function Approve({ item }: { item: CollectionQueueItem }) {
  const [state, action, pending] = useActionState(approveCollectionItem, { success: true } as ReminderActionResult);
  const link = item.invoice.phone ? whatsAppLink(item.invoice.phone, item.message) : null;
  return (
    <div className="flex flex-wrap gap-2">
      <form action={action}>
        <input type="hidden" name="invoice_id" value={item.invoice.id} />
        <Button type="submit" className="h-8" disabled={pending}>{pending ? "Préparation…" : "Valider"}</Button>
      </form>
      {link ? <Button variant="secondary" className="h-8" asChild><a href={link} target="_blank" rel="noreferrer">WhatsApp</a></Button> : null}
      {!state.success && state.error ? <p className="w-full text-xs text-red-700">{state.error}</p> : null}
      {state.success && (state.data as { message?: string } | undefined)?.message ? <p className="w-full text-xs text-emerald-700">{(state.data as { message: string }).message}</p> : null}
    </div>
  );
}

export function CollectionFile({
  queue,
  autoSend,
  arabic,
  pending,
}: {
  queue: CollectionQueueItem[];
  autoSend: boolean;
  arabic: boolean;
  pending: boolean;
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(saveCollectionSettings, { success: true } as ReminderActionResult);
  const [exclusionState, exclusionAction, exclusionPending] = useActionState(saveCollectionExclusion, { success: true } as ReminderActionResult);
  const [promiseState, promiseAction, promisePending] = useActionState(savePaymentPromise, { success: true } as ReminderActionResult);
  const customers = [...new Map(queue.map((item) => [item.invoice.customerId, item.invoice.customerName])).entries()];
  return (
    <div className="space-y-5">
      {pending ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Les exclusions, promesses et le journal d&apos;envoi attendent la migration 127. La file se calcule déjà.</p> : null}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Relances à envoyer aujourd&apos;hui</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Rien ne part sans ce clic, sauf si l&apos;envoi automatique est activé ci-dessous. Un paiement arrête la facture dès que son reste tombe à zéro.</p>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune relance à préparer aujourd&apos;hui.</p> : (
            <Table>
              <thead><tr><Th>Client</Th><Th>Facture</Th><Th>Échéance</Th><Th>Retard</Th><Th>Reste</Th><Th>Scénario</Th><Th></Th></tr></thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.invoice.id}>
                    <Td>{item.invoice.customerName}</Td>
                    <Td><Link className="text-[var(--primary)]" href={`/facturation/factures/${item.invoice.id}`}>{item.invoice.number}</Link></Td>
                    <Td>{item.invoice.dueDate}</Td>
                    <Td>{item.daysOverdue} j</Td>
                    <Td><MoneyDisplay value={item.invoice.remaining} /></Td>
                    <Td>{item.rule.name || `J${item.rule.daysAfterDue >= 0 ? "+" : ""}${item.rule.daysAfterDue}`}</Td>
                    <Td><Approve item={item} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Envoi</h2></CardHeader>
        <CardContent>
          <form action={settingsAction} className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="auto_send" defaultChecked={autoSend} /> Envoi e-mail automatique</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="include_arabic" defaultChecked={arabic} /> Ajouter une formule en arabe</label>
            <Button type="submit" variant="secondary" disabled={settingsPending}>Enregistrer</Button>
            {!settingsState.success && settingsState.error ? <span className="text-red-700">{settingsState.error}</span> : null}
          </form>
          <p className="mt-3 text-sm text-[var(--muted)]">Sans adresse d&apos;expédition configurée, l&apos;e-mail est seulement journalisé. WhatsApp s&apos;ouvre à la main. Le courrier s&apos;imprime.</p>
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Exclure un client</h2></CardHeader>
          <CardContent>
            <form action={exclusionAction} className="grid gap-3">
              <Select name="customer_id" defaultValue={customers[0]?.[0] ?? ""}>
                <option value="">Client de la file</option>
                {customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
              <Select name="reason" defaultValue="pause"><option value="pause">Pause</option><option value="dispute">Litige</option></Select>
              <Input name="paused_until" type="date" />
              <Input name="note" placeholder="Motif interne" />
              <Button type="submit" variant="secondary" disabled={exclusionPending}>Enregistrer l&apos;exclusion</Button>
              {!exclusionState.success && exclusionState.error ? <p className="text-sm text-red-700">{exclusionState.error}</p> : null}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Promesse de paiement</h2></CardHeader>
          <CardContent>
            <form action={promiseAction} className="grid gap-3">
              <Select name="customer_id" defaultValue={customers[0]?.[0] ?? ""}>
                <option value="">Client</option>
                {customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
              <Select name="invoice_id" defaultValue="">
                <option value="">Toutes les factures ouvertes</option>
                {queue.map((item) => <option key={item.invoice.id} value={item.invoice.id}>{item.invoice.number}</option>)}
              </Select>
              <Input name="promised_on" type="date" required />
              <Input name="amount" type="number" min="0.01" step="0.01" placeholder="Montant MAD" required />
              <Button type="submit" variant="secondary" disabled={promisePending}>Enregistrer la promesse</Button>
              {!promiseState.success && promiseState.error ? <p className="text-sm text-red-700">{promiseState.error}</p> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
