"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, MapPin, Phone, Mail, MapPinned, Upload } from "lucide-react";
import { createEntrepriseAction, type CreateEntrepriseState } from "@/lib/actions/create-entreprise";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { formatMoroccanPhone, MOROCCAN_CITIES } from "@/lib/morocco-format";

const initialState: CreateEntrepriseState = { error: null };
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function Field({ icon: Icon, children, error }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function EntrepriseForm({ buttonLabel, initialEmail = "" }: { buttonLabel?: string; initialEmail?: string }) {
  const [state, formAction, pending] = useActionState(createEntrepriseAction, initialState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [raisonSociale, setRaisonSociale] = useState("");
  const [telephone, setTelephone] = useState("+212 ");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const showLoadingOverlay = isSubmitting || pending;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (state.error || state.fieldErrors) {
      const timeoutId = window.setTimeout(() => setIsSubmitting(false), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [state.error, state.fieldErrors]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoError(null);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setLogoPreview(null);
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Format non autorisé. Utilisez PNG, JPG ou WEBP.");
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Le logo ne doit pas dépasser 5 Mo.");
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setLogoPreview(previewUrl);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const file = logoInputRef.current?.files?.[0];
    if (file && !ALLOWED_LOGO_TYPES.includes(file.type)) {
      event.preventDefault();
      setLogoError("Format non autorisé. Utilisez PNG, JPG ou WEBP.");
      setIsSubmitting(false);
      return;
    }
    if (file && file.size > MAX_LOGO_SIZE) {
      event.preventDefault();
      setLogoError("Le logo ne doit pas dépasser 5 Mo.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
  }

  return (
    <>
      <LoadingOverlay open={showLoadingOverlay} />
      <form action={formAction} onSubmit={handleSubmit} className="space-y-6" aria-busy={showLoadingOverlay}>
        <fieldset disabled={showLoadingOverlay} className="space-y-6 disabled:opacity-75">
          <div className="space-y-4">
        <Field icon={Building2} error={state.fieldErrors?.raisonSociale}>
          <input
            name="raisonSociale"
            placeholder="Raison sociale *"
            value={raisonSociale}
            onChange={(event) => setRaisonSociale(event.target.value.toLocaleUpperCase("fr-FR"))}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </Field>
        <Field icon={MapPinned} error={state.fieldErrors?.adresse}>
          <input
            name="adresse"
            placeholder="Adresse complète de l'entreprise *"
            defaultValue=""
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={MapPin} error={state.fieldErrors?.ville}>
            <input
              name="ville"
              list="moroccan-cities"
              placeholder="Ville *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
            <datalist id="moroccan-cities">
              {MOROCCAN_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>
          <Field icon={Phone} error={state.fieldErrors?.telephone}>
            <input
              name="telephone"
              type="tel"
              placeholder="+212 524 10 10 10"
              value={telephone}
              onChange={(event) => setTelephone(formatMoroccanPhone(event.target.value))}
              onBlur={() => setTelephone(formatMoroccanPhone(telephone))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
        </div>
        <Field icon={Mail} error={state.fieldErrors?.emailEnt}>
          <input
            name="emailEnt"
            type="email"
            placeholder="Adresse mail *"
            defaultValue={initialEmail}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </Field>
        <input type="hidden" name="devise" value="MAD" />
          </div>

          <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Logo de l&apos;entreprise</h2>
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition hover:border-slate-300">
          <input
            ref={logoInputRef}
            id="onboarding-company-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
          {logoPreview ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Aperçu logo" className="h-full w-full object-contain p-2" />
              </div>
              <label htmlFor="onboarding-company-logo" className="cursor-pointer text-sm font-medium text-blue-600 transition hover:text-blue-700">
                Changer le logo
              </label>
              <p className="text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo</p>
              {(logoError || state.fieldErrors?.logo) && <p className="text-xs text-red-500">{logoError ?? state.fieldErrors?.logo}</p>}
            </div>
          ) : (
            <label htmlFor="onboarding-company-logo" className="flex cursor-pointer flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Ajouter un logo</p>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo</p>
              </div>
            </label>
          )}
          <p className="mt-4 text-center text-xs text-slate-400">
            Ce logo sera utilisé sur vos devis, factures et documents PDF.
          </p>
          {(logoError || (state.fieldErrors?.logo && !logoPreview)) && (
            <p className="mt-2 text-center text-xs text-red-500">{logoError ?? state.fieldErrors?.logo}</p>
          )}
        </div>
          </div>

          {state.error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {state.error || "La création de l’entreprise a échoué. Veuillez réessayer."}
            </p>
          )}

          <Button type="submit" disabled={showLoadingOverlay || Boolean(logoError)} className="h-12 w-full rounded-xl text-base font-semibold">
            {showLoadingOverlay ? "Création en cours..." : (buttonLabel ?? "Créer mon entreprise")}
          </Button>
        </fieldset>
      </form>
    </>
  );
}
