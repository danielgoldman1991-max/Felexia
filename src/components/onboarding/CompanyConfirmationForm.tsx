"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, FileText, Globe2, Mail, MapPin, Phone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { createEntrepriseAction, type CreateEntrepriseState } from "@/lib/actions/create-entreprise";
import type { CompanyOnboardingPrefill } from "@/lib/company-lookup/types";
import { normalizeCompanyName, normalizeIce, normalizeMoroccanPhone } from "@/lib/ice/ice";

const initialState: CreateEntrepriseState = { error: null };
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function Field({
  label,
  name,
  defaultValue = "",
  error,
  type = "text",
  required = false,
  icon: Icon,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  onChange?: (value: string) => string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}{required ? " *" : ""}
      </label>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/65" /> : null}
        <input
          name={name}
          type={type}
          value={value}
          onChange={(event) => setValue(onChange ? onChange(event.target.value) : event.target.value)}
          placeholder={placeholder}
          required={required}
          className={`h-12 w-full rounded-2xl border border-white/10 bg-white/[0.045] ${Icon ? "pl-11" : "pl-4"} pr-4 text-sm text-white outline-none transition placeholder:text-[var(--muted-2)] focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10`}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export function CompanyConfirmationForm({
  initialEmail,
  prefill,
  onBack,
}: {
  initialEmail: string;
  prefill?: CompanyOnboardingPrefill | null;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState(createEntrepriseAction, initialState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
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

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setLogoError(null);

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;

    if (!file) {
      setLogoPreview(null);
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Format accepté : PNG, JPG, WEBP");
      setLogoPreview(null);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("Logo trop volumineux (max 5 Mo)");
      setLogoPreview(null);
      event.target.value = "";
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
      setLogoError("Format accepté : PNG, JPG, WEBP");
      return;
    }
    if (file && file.size > MAX_LOGO_SIZE) {
      event.preventDefault();
      setLogoError("Logo trop volumineux (max 5 Mo)");
      return;
    }
    setIsSubmitting(true);
  }

  return (
    <>
      <LoadingOverlay open={showLoadingOverlay} />
      <form action={formAction} onSubmit={handleSubmit} className="space-y-6" aria-busy={showLoadingOverlay}>
        <fieldset disabled={showLoadingOverlay} className="space-y-6 disabled:opacity-75">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Confirmez les informations de votre entreprise</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Vérifiez les informations avant de créer votre espace Felexia.</p>
            </div>
            <Button type="button" variant="secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </div>

          <section className="premium-card rounded-[24px] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Informations principales</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Raison sociale" name="raisonSociale" defaultValue={prefill?.raisonSociale ?? ""} error={state.fieldErrors?.raisonSociale} icon={Building2} required onChange={normalizeCompanyName} />
              <Field label="Forme juridique" name="formeJuridique" defaultValue={prefill?.formeJuridique ?? ""} placeholder="SARL, SA, personne physique..." />
              <Field label="ICE" name="ice" defaultValue={prefill?.ice ?? ""} error={state.fieldErrors?.ice} icon={FileText} onChange={normalizeIce} />
              <Field label="Identifiant fiscal" name="identifiantFiscal" defaultValue={prefill?.identifiantFiscal ?? ""} />
              <Field label="RC" name="rc" defaultValue={prefill?.rc ?? ""} />
              <Field label="Ville RC" name="villeRc" defaultValue={prefill?.villeRc ?? ""} />
              <Field label="CNSS" name="cnss" defaultValue={prefill?.cnss ?? ""} />
            </div>
          </section>

          <section className="premium-card rounded-[24px] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Coordonnées</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Adresse complète" name="adresse" defaultValue={prefill?.adresse ?? ""} error={state.fieldErrors?.adresse} icon={MapPin} required />
              </div>
              <Field label="Ville" name="ville" defaultValue={prefill?.ville ?? ""} error={state.fieldErrors?.ville} icon={MapPin} required />
              <Field label="Téléphone" name="telephone" defaultValue="+212 " error={state.fieldErrors?.telephone} icon={Phone} required onChange={normalizeMoroccanPhone} />
              <Field label="Email administrateur" name="emailEnt" type="email" defaultValue={initialEmail} error={state.fieldErrors?.emailEnt} icon={Mail} required />
              <Field label="Site web" name="website" defaultValue="" icon={Globe2} placeholder="https://..." />
            </div>
          </section>

          <section className="premium-card rounded-[24px] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Activité et identité visuelle</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Activité principale" name="activite" defaultValue={prefill?.activite ?? ""} />
              <Field label="Secteur d’activité" name="secteur" defaultValue="" />
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Logo</label>
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.035] p-6 transition hover:border-white/20">
                  <input ref={logoInputRef} id="company-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
                  {logoPreview ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoPreview} alt="Aperçu logo" className="h-full w-full object-contain p-2" />
                      </div>
                      <label htmlFor="company-logo" className="cursor-pointer text-sm font-medium text-cyan-100 transition hover:text-cyan-200">Changer le logo</label>
                    </div>
                  ) : (
                    <label htmlFor="company-logo" className="flex cursor-pointer flex-col items-center gap-3 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6B56D]/12 text-[#D6B56D] ring-1 ring-[#D6B56D]/20">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-white">Ajouter un logo</span>
                      <span className="text-xs text-[var(--muted)]">PNG, JPG ou WEBP - Max 5 Mo</span>
                    </label>
                  )}
                  {(logoError || state.fieldErrors?.logo) ? <p className="mt-3 text-center text-xs text-red-300">{logoError ?? state.fieldErrors?.logo}</p> : null}
                </div>
              </div>
            </div>
          </section>

          <p className="rounded-2xl border border-[#D6B56D]/20 bg-[#D6B56D]/8 px-4 py-3 text-xs leading-5 text-[#E7D7AA]">
            Les données proposées sont indicatives. Veuillez vérifier les informations auprès des sources officielles avant validation.
          </p>

          {state.error ? (
            <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={showLoadingOverlay || Boolean(logoError)}>
              {showLoadingOverlay ? "Création en cours..." : "Créer mon entreprise"}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
