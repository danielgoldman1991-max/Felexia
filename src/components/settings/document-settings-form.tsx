"use client";

import { useActionState } from "react";
import { updateDocumentSettingsAction, type DocState } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const initialState: DocState = { error: null, success: false };

export function DocumentSettingsForm({
  organizationId,
  settings,
  canEdit,
}: {
  organizationId: string;
  settings: Record<string, unknown> | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateDocumentSettingsAction, initialState);
  const s = settings ?? {};

  if (!canEdit) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            Vous n&apos;avez pas les droits nécessaires pour modifier ces paramètres.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Préfixes des documents</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Préfixe devis</label>
            <Input name="quote_prefix" defaultValue={String(s.quote_prefix ?? "DEV")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Préfixe facture</label>
            <Input name="invoice_prefix" defaultValue={String(s.invoice_prefix ?? "FAC")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Préfixe avoir</label>
            <Input name="credit_note_prefix" defaultValue={String(s.credit_note_prefix ?? "AV")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Préfixe bon livraison</label>
            <Input name="delivery_note_prefix" defaultValue={String(s.delivery_note_prefix ?? "BL")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Préfixe paiement</label>
            <Input name="payment_prefix" defaultValue={String(s.payment_prefix ?? "REG")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Format numérotation</label>
            <Input name="numbering_format" defaultValue={String(s.numbering_format ?? "{PREFIX}-{YEAR}-{NUMBER}")} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold">Mentions et apparence</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Conditions de paiement</label>
            <textarea
              name="invoice_terms"
              defaultValue={String(s.invoice_terms ?? "")}
              rows={3}
              className="h-20 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Mentions légales</label>
            <textarea
              name="legal_mentions"
              defaultValue={String(s.legal_mentions ?? "")}
              rows={3}
              className="h-20 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Pied de page facture</label>
            <textarea
              name="footer_note"
              defaultValue={String(s.footer_note ?? "")}
              rows={2}
              className="h-16 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Couleur principale PDF</label>
            <Input name="primary_color" type="color" defaultValue={String(s.primary_color ?? "#111827")} className="h-10 w-20 p-1" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold">Affichage sur les documents</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_ice" defaultChecked={s.show_ice !== false} className="rounded" />
            Afficher ICE sur les factures
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_rc" defaultChecked={s.show_rc !== false} className="rounded" />
            Afficher RC sur les factures
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_stamp_signature" defaultChecked={s.show_stamp_signature !== false} className="rounded" />
            Afficher signature / cachet
          </label>
        </CardContent>
      </Card>

      {state.success && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Paramètres documents enregistrés.
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
