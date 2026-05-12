"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import { AccountCombobox } from "@/components/accounting/account-combobox";
import { EntryStatusBadge } from "@/components/accounting/accounting-status-badge";
import { DocumentFlowMap } from "@/components/shared/document-flow-map";
import { formatDate } from "@/lib/format";
import type { AccountingEntryDetail, AccountingActionResult, AccountingEntryLineRecord, ChartOfAccountOption } from "@/lib/accounting-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";

type Props = {
  detail: AccountingEntryDetail;
  postAction: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  updateLineAccountAction: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  accounts: ChartOfAccountOption[];
  documentFlow?: DocumentFlowStep[];
};

export function EntryDetailView({ detail, postAction, updateLineAccountAction, accounts, documentFlow }: Props) {
  const { entry } = detail;
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  if (!entry) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-[var(--muted)]">
          Ecriture introuvable.
        </CardContent>
      </Card>
    );
  }

  const lines = detail.lines ?? [];
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const canEditLineAccounts = entry.status !== "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/comptabilite/ecritures"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux ecritures
        </Link>
        <div className="flex items-center gap-2">
          {entry.status === "draft" ? (
            <ButtonForm action={postAction} entryId={entry.id} variant="secondary">
              <CheckCircle className="mr-1 h-4 w-4" /> Valider l&apos;ecriture
            </ButtonForm>
          ) : null}
        </div>
      </div>

      <DocumentFlowMap steps={documentFlow ?? []} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{entry.entry_number}</h2>
              <p className="text-sm text-[var(--muted)]">{entry.label}</p>
            </div>
            <EntryStatusBadge status={entry.status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-[var(--muted)]">Journal:</span> {entry.journal_code ?? "-"} - {entry.journal_name ?? ""}</div>
          <div><span className="text-[var(--muted)]">Date:</span> {formatDate(entry.entry_date)}</div>
          <div><span className="text-[var(--muted)]">Reference:</span> {entry.reference ?? "-"}</div>
          <div><span className="text-[var(--muted)]">Statut:</span> <EntryStatusBadge status={entry.status} /></div>
          {entry.posted_at ? <div><span className="text-[var(--muted)]">Validee le:</span> {formatDate(entry.posted_at)}</div> : null}
          {entry.notes ? <div className="col-span-2"><span className="text-[var(--muted)]">Notes:</span> {entry.notes}</div> : null}
          {entry.source_document_type === "customer_invoice" ? (
            <div className="col-span-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--muted)]">
              Pour corriger cette ecriture issue d&apos;une facture client, creez un avoir client depuis la facture ou utilisez une ecriture corrective.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="font-semibold">Lignes d&apos;ecriture</h2>
            {!canEditLineAccounts ? (
              <p className="mt-1 text-xs text-[var(--muted)]">Cette ecriture est annulee, les lignes ne sont plus modifiables.</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Compte</Th><Th>Libelle</Th><Th>Debit</Th><Th>Credit</Th><Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <Td>
                    {editingLineId === line.id ? (
                      <AccountLineEditForm
                        line={line}
                        accounts={accounts}
                        action={updateLineAccountAction}
                        onCancel={() => setEditingLineId(null)}
                      />
                    ) : (
                      <>
                        <span className="font-mono text-sm font-medium">{line.account_code}</span>
                        <span className="ml-2 text-xs text-[var(--muted)]">{line.account_label}</span>
                      </>
                    )}
                  </Td>
                  <Td>{line.label ?? "-"}</Td>
                  <Td>{line.debit > 0 ? <MoneyDisplay value={line.debit} /> : "-"}</Td>
                  <Td>{line.credit > 0 ? <MoneyDisplay value={line.credit} /> : "-"}</Td>
                  <Td>
                    {canEditLineAccounts && editingLineId !== line.id ? (
                      <button
                        type="button"
                        onClick={() => setEditingLineId(line.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 text-xs font-medium text-[var(--secondary)] hover:bg-[var(--surface-soft)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier compte
                      </button>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)] font-medium">
                <td colSpan={2} className="px-4 py-3.5 align-middle text-right">Totaux</td>
                <td className="border-t border-[var(--border)] px-4 py-3.5 align-middle"><MoneyDisplay value={totalDebit} /></td>
                <td className="border-t border-[var(--border)] px-4 py-3.5 align-middle"><MoneyDisplay value={totalCredit} /></td>
                <td className="border-t border-[var(--border)] px-4 py-3.5 align-middle" />
              </tr>
              <tr>
                <td colSpan={5} className="px-4 py-3.5 align-middle">
                  <span className={`text-xs font-medium ${balanced ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {balanced ? "Ecriture equilibree" : "Ecriture desequilibree"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountLineEditForm({
  line,
  accounts,
  action,
  onCancel,
}: {
  line: AccountingEntryLineRecord;
  accounts: ChartOfAccountOption[];
  action: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="min-w-[280px] space-y-2">
      <input type="hidden" name="entry_line_id" value={line.id} />
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
        Compte actuel : <span className="font-mono font-semibold">{line.account_code}</span> {line.account_label}
      </div>
      <AccountCombobox accounts={accounts} value={line.account_id} />
      <div className="flex items-center gap-2">
        <Button type="submit" className="h-8 px-3 text-xs" disabled={pending}>Enregistrer</Button>
        <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={onCancel} disabled={pending}>Annuler</Button>
      </div>
      {!state.success && state.error ? (
        <p className="text-xs text-[var(--danger)]">{state.error}</p>
      ) : null}
    </form>
  );
}

function ButtonForm({
  action,
  entryId,
  variant,
  children,
}: {
  action: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  entryId: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={entryId} />
      <Button type="submit" variant={variant} disabled={pending}>
        {children}
      </Button>
      {!state.success && state.error ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{state.error}</p>
      ) : null}
    </form>
  );
}
