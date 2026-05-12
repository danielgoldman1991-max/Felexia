"use client";

import { useActionState } from "react";
import { updateCompanyAction, type CompanyState } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const initialState: CompanyState = { error: null, success: false };

export function CompanySettingsForm({
  organizationId,
  settings,
  canEdit,
}: {
  organizationId: string;
  settings: Record<string, unknown> | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCompanyAction, initialState);
  const s = settings ?? {};

  if (!canEdit) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            Vous n&apos;avez pas les droits nécessaires pour modifier les informations de l&apos;entreprise.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Informations légales</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Raison sociale</label>
            <Input name="legal_name" defaultValue={String(s.legal_name ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Nom commercial</label>
            <Input name="commercial_name" defaultValue={String(s.commercial_name ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">ICE</label>
            <Input name="ice" defaultValue={String(s.ice ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">RC</label>
            <Input name="rc" defaultValue={String(s.rc ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">IF</label>
            <Input name="if_number" defaultValue={String(s.if_number ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">CNSS</label>
            <Input name="cnss" defaultValue={String(s.cnss ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Identifiant fiscal</label>
            <Input name="tax_identifier" defaultValue={String(s.tax_identifier ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Activité</label>
            <Input name="activity" defaultValue={String(s.activity ?? "")} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold">Coordonnées</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Adresse</label>
            <Input name="address" defaultValue={String(s.address ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Ville</label>
            <Input name="city" defaultValue={String(s.city ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Pays</label>
            <Input name="country" defaultValue={String(s.country ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Téléphone</label>
            <Input name="phone" defaultValue={String(s.phone ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Email</label>
            <Input name="email" type="email" defaultValue={String(s.email ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Site web</label>
            <Input name="website" defaultValue={String(s.website ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Devise</label>
            <Input name="currency" defaultValue={String(s.currency ?? "MAD")} />
          </div>
        </CardContent>
      </Card>

      {state.success && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Les paramètres de l&apos;entreprise ont été enregistrés.
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
