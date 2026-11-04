"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveReminderRuleAction } from "@/lib/sales/commercial-terms-actions";

export function ReminderRuleForm({ initial }: { initial?: { id: string; name: string; days: number; level: number; channel: string; subject: string; message: string; active: boolean } }) {
  const [state, action, pending] = useActionState(saveReminderRuleAction, { success: false, error: undefined });
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <label className="text-sm md:col-span-2">Nom<Input name="name" required defaultValue={initial?.name ?? ""} className="mt-1" /></label>
      <label className="text-sm">Jours par rapport à l’échéance (négatif = avant)<Input name="days_after_due" type="number" min="-30" max="180" defaultValue={String(initial?.days ?? 7)} className="mt-1" /></label>
      <label className="text-sm">Niveau
        <select name="level" defaultValue={String(initial?.level ?? 1)} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="1">Niveau 1 — amiable</option>
          <option value="2">Niveau 2 — rappel</option>
          <option value="3">Niveau 3 — ferme</option>
          <option value="4">Niveau 4 — mise en demeure</option>
        </select>
      </label>
      <label className="text-sm">Canal
        <select name="channel" defaultValue={initial?.channel ?? "email"} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="email">E-mail</option>
          <option value="phone">Téléphone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="letter">Courrier</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={initial?.active ?? true} /> Règle active</label>
      <label className="text-sm md:col-span-2">Objet<Input name="subject" defaultValue={initial?.subject ?? "Relance de factures échues"} className="mt-1" /></label>
      <label className="text-sm md:col-span-2">Message<Textarea name="message" defaultValue={initial?.message ?? ""} className="mt-1" /></label>
      {state.error ? <p className="text-sm text-red-700 md:col-span-2">{state.error}</p> : null}
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la règle"}</Button>
        <Button type="button" variant="secondary" asChild><Link href="/facturation/relances/regles">Annuler</Link></Button>
      </div>
    </form>
  );
}
