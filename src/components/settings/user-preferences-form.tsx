"use client";

import { useActionState } from "react";
import { updatePreferencesAction, type PrefsState } from "@/lib/actions/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const initialState: PrefsState = { error: null, success: false };

export function UserPreferencesForm({
  userId,
  organizationId,
  preferences,
}: {
  userId: string;
  organizationId: string;
  preferences: Record<string, unknown> | null;
}) {
  const [state, formAction, pending] = useActionState(updatePreferencesAction, initialState);
  const p = preferences ?? {};

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Affichage</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Langue</label>
            <select
              name="language"
              defaultValue={String(p.language ?? "fr")}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Devise</label>
            <select
              name="currency"
              defaultValue={String(p.currency ?? "MAD")}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            >
              <option value="MAD">MAD</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Format date</label>
            <select
              name="date_format"
              defaultValue={String(p.date_format ?? "DD/MM/YYYY")}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Fuseau horaire</label>
            <select
              name="timezone"
              defaultValue={String(p.timezone ?? "Africa/Casablanca")}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            >
              <option value="Africa/Casablanca">Africa/Casablanca</option>
              <option value="Africa/Algiers">Africa/Algiers</option>
              <option value="Africa/Tunis">Africa/Tunis</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Thème</label>
            <select
              name="theme"
              defaultValue={String(p.theme ?? "system")}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
            >
              <option value="system">Système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Lignes par page</label>
            <Input name="rows_per_page" type="number" defaultValue={String(p.rows_per_page ?? 20)} min={5} max={100} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold">Options</h2>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="compact_mode" defaultChecked={p.compact_mode === true} className="rounded" />
            Mode compact
          </label>
        </CardContent>
      </Card>

      {state.success && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Préférences enregistrées.
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer les préférences"}
        </Button>
      </div>
    </form>
  );
}
