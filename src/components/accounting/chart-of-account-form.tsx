"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ACCOUNT_CLASS_OPTIONS, ACCOUNT_TYPE_OPTIONS, type AccountingAccountRecord, type AccountingActionResult } from "@/lib/accounting-types";
import { createChartOfAccount, updateChartOfAccount } from "@/lib/accounting-actions";
import { ArrowLeft, Save } from "lucide-react";

export function ChartOfAccountForm({
  account,
  parentOptions,
}: {
  account?: AccountingAccountRecord | null;
  parentOptions: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const isEdit = !!account;
  const action = isEdit ? updateChartOfAccount : createChartOfAccount;
  const [state, formAction, pending] = useActionState(action, { success: false } as AccountingActionResult);

  if (state.success) {
    router.push("/comptabilite/plan-comptable");
    return null;
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{state.error}</div>
      )}

      {isEdit && <input type="hidden" name="id" value={account!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Numero de compte *</label>
          <input
            type="text"
            name="code"
            defaultValue={account?.code ?? ""}
            required
            readOnly={isEdit}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm font-mono outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)] disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="34210001"
            onChange={(e) => {
              if (!isEdit) {
                const cls = e.target.value.charAt(0);
                const clsInput = document.querySelector<HTMLSelectElement>("select[name='class_number']");
                if (clsInput && cls && !clsInput.value) {
                  for (const opt of clsInput.options) {
                    if (opt.value === cls) { clsInput.value = cls; break; }
                  }
                }
              }
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Intitule du compte *</label>
          <input
            type="text"
            name="name"
            defaultValue={account?.name ?? ""}
            required
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            placeholder="Client ATLAS"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Classe</label>
          <Select name="class_number" defaultValue={account?.class_number ?? ""}>
            <option value="">Auto (deduite du numero)</option>
            {ACCOUNT_CLASS_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Type de compte</label>
          <Select name="type" defaultValue={account?.type ?? ""}>
            <option value="">Selectionnez...</option>
            {ACCOUNT_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Compte parent</label>
          <Select name="parent_account_id" defaultValue={account?.parent_account_id ?? "none"}>
            <option value="none">Aucun</option>
            {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
          </Select>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_auxiliary" defaultChecked={account?.is_auxiliary ?? false} className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)]" />
            Compte auxiliaire
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={account?.is_active ?? true} className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)]" />
              Actif
            </label>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Notes</label>
        <textarea
          name="notes"
          defaultValue={account?.notes ?? ""}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
          placeholder="Notes optionnelles..."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}><Save className="h-4 w-4" /> {isEdit ? "Enregistrer les modifications" : "Creer le compte"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/comptabilite/plan-comptable")}><ArrowLeft className="h-4 w-4" /> Annuler</Button>
      </div>
    </form>
  );
}