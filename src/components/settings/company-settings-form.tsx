"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { updateCompanyAction, type CompanyState } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const initialState: CompanyState = { error: null, success: false };
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function CompanySettingsForm({
  settings,
  canEdit,
}: {
  settings: Record<string, unknown> | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCompanyAction, initialState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const s = settings ?? {};

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    };
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoError(null);

    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    setLogoPreview(null);

    if (!file) {
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Le logo ne doit pas dépasser 5 Mo.");
      e.target.value = "";
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Format non autorisé. Utilisez PNG, JPG ou WEBP.");
      e.target.value = "";
      return;
    }

    if (file) {
      const previewUrl = URL.createObjectURL(file);
      logoPreviewRef.current = previewUrl;
      setLogoPreview(previewUrl);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const file = logoInputRef.current?.files?.[0];

    if (!file) {
      setLogoError(null);
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      event.preventDefault();
      setLogoError("Le logo ne doit pas dépasser 5 Mo.");
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      event.preventDefault();
      setLogoError("Format non autorisé. Utilisez PNG, JPG ou WEBP.");
    }
  }

  const currentLogo = s.logo_url as string | null | undefined;

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
    <form action={formAction} onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Logo</h2>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition hover:border-slate-300">
            <input
              ref={logoInputRef}
              id="company-logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            {logoPreview || currentLogo ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview ?? currentLogo ?? ""}
                    alt="Logo actuel"
                    className="h-full w-full object-contain p-2"
                  />
                </div>
                <label htmlFor="company-logo" className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                  Changer le logo
                </label>
                <p className="text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo. Utilisez de préférence un logo inférieur à 1 Mo.</p>
              </div>
            ) : (
              <label htmlFor="company-logo" className="flex cursor-pointer flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Ajouter un logo</p>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo. Idéalement moins de 1 Mo.</p>
                </div>
              </label>
            )}
            {logoError ? (
              <p className="mt-3 text-center text-xs text-red-600">{logoError}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
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
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Patente</label>
            <Input name="patente" defaultValue={String(s.patente ?? "")} />
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
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Adresse</label>
            <Input name="address" defaultValue={String(s.address ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Ville</label>
            <Input name="city" defaultValue={String(s.city ?? "")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Pays</label>
            <Input name="country" defaultValue={String(s.country ?? "Maroc")} />
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

      <Card className="mt-4">
        <CardHeader>
          <h2 className="font-semibold">Documents</h2>
        </CardHeader>
        <CardContent>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Texte de pied de page</label>
            <Input name="footer_text" defaultValue={String(s.footer_text ?? "")} placeholder="Merci pour votre confiance" />
            <p className="mt-1 text-xs text-[var(--muted)]">Ce texte apparaîtra sur vos factures et devis.</p>
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
        <Button type="submit" disabled={pending || Boolean(logoError)}>
          {pending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
