"use client";

import { useActionState, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import type { AccountingActionResult, AccountingEntryLineFormValue, AccountingEntryFormValues, AccountingJournalRecord, AccountingAccountRecord } from "@/lib/accounting-types";

type Props = {
  action: (state: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  journals: AccountingJournalRecord[];
  accounts: AccountingAccountRecord[];
  initialValues?: AccountingEntryFormValues;
};

let lineIdCounter = 0;
function nextLineId() {
  lineIdCounter += 1;
  return `line-${lineIdCounter}`;
}

export function EntryForm({ action, journals, accounts, initialValues }: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  const [journalId, setJournalId] = useState(initialValues?.journal_id ?? "");
  const [entryDate, setEntryDate] = useState(initialValues?.entry_date ?? new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState(initialValues?.reference ?? "");
  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [lines, setLines] = useState<AccountingEntryLineFormValue[]>(
    initialValues?.lines ?? [
      { id: nextLineId(), account_id: "", account_code: "", account_label: "", debit: 0, credit: 0, label: "" },
      { id: nextLineId(), account_id: "", account_code: "", account_label: "", debit: 0, credit: 0, label: "" },
    ],
  );
  const [accountSearch, setAccountSearch] = useState("");

  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return accounts;
    const q = accountSearch.toLowerCase();
    return accounts.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += line.debit;
      credit += line.credit;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
  }, [lines]);

  const setLine = useCallback((id: string, update: Partial<AccountingEntryLineFormValue>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...update } : l)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { id: nextLineId(), account_id: "", account_code: "", account_label: "", debit: 0, credit: 0, label: "" }]);
  }, []);

  const selectAccount = useCallback((lineId: string, account: AccountingAccountRecord) => {
    setLine(lineId, { account_id: account.id, account_code: account.code, account_label: account.name });
    setAccountSearch("");
  }, [setLine]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="journal_id" value={journalId} />
      <input type="hidden" name="entry_date" value={entryDate} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="label" value={label} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <Card>
        <CardHeader><h2 className="font-semibold">En-tete</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Journal *</label>
              <select
                value={journalId}
                onChange={(e) => setJournalId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
                required
              >
                <option value="">Selectionnez un journal</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.code} - {j.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Date *</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Libelle *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
              placeholder="Libelle de l'ecriture"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
                placeholder="Reference"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
                placeholder="Notes internes"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="font-semibold">Lignes d&apos;ecriture</h2>
          <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" />Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <thead>
              <tr>
                <Th>Compte</Th><Th>Libelle ligne</Th><Th>Debit</Th><Th>Credit</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <Td>
                    <div className="relative">
                      <input
                        type="text"
                        value={line.account_code ? `${line.account_code} - ${line.account_label}` : ""}
                        onChange={(e) => {
                          setAccountSearch(e.target.value);
                          if (!e.target.value) setLine(line.id, { account_id: "", account_code: "", account_label: "" });
                        }}
                        onFocus={() => setAccountSearch("")}
                        className="h-8 w-56 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]"
                        placeholder="Chercher un compte..."
                      />
                      {accountSearch && (
                        <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-72 overflow-auto rounded-md border border-[var(--border)] bg-white shadow-lg">
                          {filteredAccounts.slice(0, 20).map((acct) => (
                            <button
                              key={acct.id}
                              type="button"
                              onClick={() => selectAccount(line.id, acct)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                            >
                              <span className="font-mono font-medium">{acct.code}</span>
                              <span className="text-[var(--muted)]">{acct.name}</span>
                            </button>
                          ))}
                          {filteredAccounts.length === 0 && (
                            <p className="px-3 py-2 text-xs text-[var(--muted)]">Aucun compte trouve</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <input
                      type="text"
                      value={line.label}
                      onChange={(e) => setLine(line.id, { label: e.target.value })}
                      className="h-8 w-40 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]"
                      placeholder="Libelle ligne"
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit || ""}
                      onChange={(e) => setLine(line.id, { debit: Number(e.target.value), credit: 0 })}
                      className="h-8 w-28 rounded-md border border-[var(--border)] bg-white px-2 text-right text-xs font-mono outline-none focus:border-[var(--primary)]"
                      placeholder="0.00"
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit || ""}
                      onChange={(e) => setLine(line.id, { credit: Number(e.target.value), debit: 0 })}
                      className="h-8 w-28 rounded-md border border-[var(--border)] bg-white px-2 text-right text-xs font-mono outline-none focus:border-[var(--primary)]"
                      placeholder="0.00"
                    />
                  </Td>
                  <Td>
                    {lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <div className="flex gap-6 text-sm">
              <span className="text-[var(--muted)]">Total Debit: <strong className="text-[var(--foreground)]"><MoneyDisplay value={totals.debit} /></strong></span>
              <span className="text-[var(--muted)]">Total Credit: <strong className="text-[var(--foreground)]"><MoneyDisplay value={totals.credit} /></strong></span>
              <span className={`font-medium ${totals.balanced ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {totals.balanced ? "Equilibre" : "Desequilibre"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link href="/comptabilite/ecritures">
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>{pending ? "Enregistrement..." : "Creer l'ecriture"}</Button>
      </div>
    </form>
  );
}
