"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { updateCompanyAction, type CompanyState } from "@/lib/actions/company";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const initialState: CompanyState = { error: null, success: false };
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function createUniqueLogoPath(organizationId: string, ext: string) {
  const timestamp = Date.now();
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);

  return `organizations/${organizationId}/logo-${timestamp}-${uniqueId}.${ext}`;
}

export type CompanySettingsFormValues = {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string;
  commercial_name: string;
  forme_juridique: string;
  ice: string;
  rc: string;
  ville_rc: string;
  if_number: string;
  cnss: string;
  patente: string;
  tax_identifier: string;
  activity: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  currency: string;
  footer_text: string;
  logo_url: string;
  logo_path: string;
  updated_at: string | null;
};

export function CompanySettingsForm({
  settings,
  canEdit,
}: {
  settings: CompanySettingsFormValues;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCompanyAction, initialState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const logoPreviewRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const logoPathRef = useRef<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);
  const s = settings;

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("logo");
    const file = logoInputRef.current?.files?.[0];

    if (file) {
      if (file.size > MAX_LOGO_SIZE) {
        setLogoError("Le logo ne doit pas dépasser 5 Mo.");
        return;
      }

      const ext = LOGO_MIME_TO_EXT[file.type];
      if (!ext) {
        setLogoError("Format non autorisé. Utilisez PNG, JPG ou WEBP.");
        return;
      }

      setUploading(true);
      setLogoError(null);
      try {
        const supabase = createClient();
        const logoPath = createUniqueLogoPath(s.organization_id, ext);
        const { error: uploadError } = await supabase.storage
          .from("organization-logos")
          .upload(logoPath, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setLogoError(uploadError.message);
          setUploading(false);
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from("organization-logos")
          .getPublicUrl(logoPath);

        logoPathRef.current = logoPath;
        logoUrlRef.current = publicUrl.publicUrl;
        if (logoInputRef.current) {
          logoInputRef.current.value = "";
        }
      } catch (err) {
        setLogoError(err instanceof Error ? err.message : "Erreur lors de l'upload du logo.");
        setUploading(false);
        return;
      }
    }

    if (logoPathRef.current && logoUrlRef.current) {
      formData.set("logo_path", logoPathRef.current);
      formData.set("logo_url", logoUrlRef.current);
    }

    formAction(formData);
  }

  const currentLogo = s.logo_url;

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
                <p className="text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo.</p>
              </div>
            ) : (
              <label htmlFor="company-logo" className="flex cursor-pointer flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Ajouter un logo</p>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo.</p>
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
            <Input name="legal_name" defaultValue={s.legal_name} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Nom commercial</label>
            <Input name="commercial_name" defaultValue={s.commercial_name} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Forme juridique</label>
            <Input name="forme_juridique" defaultValue={s.forme_juridique} placeholder="SARL, SA, personne physique..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">ICE</label>
            <Input name="ice" defaultValue={s.ice} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">RC</label>
            <Input name="rc" defaultValue={s.rc} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Ville RC</label>
            <Input name="ville_rc" defaultValue={s.ville_rc} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">IF</label>
            <Input name="if_number" defaultValue={s.if_number} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">CNSS</label>
            <Input name="cnss" defaultValue={s.cnss} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Patente</label>
            <Input name="patente" defaultValue={s.patente} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Activité</label>
            <Input name="activity" defaultValue={s.activity} />
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
            <Input name="address" defaultValue={s.address} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Ville</label>
            <Input name="city" defaultValue={s.city} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Pays</label>
            <Input name="country" defaultValue={s.country} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Téléphone</label>
            <Input name="phone" defaultValue={s.phone} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Email</label>
            <Input name="email" type="email" defaultValue={s.email} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Site web</label>
            <Input name="website" defaultValue={s.website} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--secondary)]">Devise</label>
            <Input name="currency" defaultValue={s.currency} />
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
            <Input name="footer_text" defaultValue={s.footer_text} placeholder="Merci pour votre confiance" />
            <p className="mt-1 text-xs text-[var(--muted)]">Ce texte apparaîtra sur vos factures et devis.</p>
          </div>
        </CardContent>
      </Card>

      {state.success && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.message ?? "Les paramètres de l'entreprise ont été enregistrés."}
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending || uploading || Boolean(logoError)}>
          {uploading ? "Upload du logo..." : pending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
