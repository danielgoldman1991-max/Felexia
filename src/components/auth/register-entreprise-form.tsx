"use client";

import { useState, useActionState } from "react";
import { Building2, IdCard, MapPin, Phone, Mail, MapPinned, Briefcase, Users, User, Lock, Eye, EyeOff, Upload } from "lucide-react";
import { registerCompanyAction, type RegisterCompanyState } from "@/lib/actions/register-company";
import { Button } from "@/components/ui/button";

const initialState: RegisterCompanyState = { error: null };

const SECTEUR_OPTIONS = [
  { value: "", label: "Sélectionnez un secteur" },
  { value: "commerce", label: "Commerce" },
  { value: "services", label: "Services" },
  { value: "industrie", label: "Industrie" },
  { value: "btp", label: "BTP" },
  { value: "transport", label: "Transport" },
  { value: "immobilier", label: "Immobilier" },
  { value: "tourisme", label: "Tourisme" },
  { value: "autre", label: "Autre" },
];

const TAILLE_OPTIONS = [
  { value: "", label: "Sélectionnez la taille" },
  { value: "1-5", label: "1 à 5 personnes" },
  { value: "6-20", label: "6 à 20 personnes" },
  { value: "21-50", label: "21 à 50 personnes" },
  { value: "51-100", label: "51 à 100 personnes" },
  { value: "100+", label: "Plus de 100 personnes" },
];

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

export function RegisterEntrepriseForm() {
  const [state, formAction, pending] = useActionState(registerCompanyAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  return (
    <form action={formAction} className="space-y-10">
      {/* ── Section 1: Entreprise ─────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Votre entreprise</h2>
        <div className="space-y-4">
          <Field icon={Building2} error={state.fieldErrors?.raisonSociale}>
            <input
              name="raisonSociale"
              placeholder="Raison sociale *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
          <Field icon={IdCard}>
            <input
              name="ice"
              placeholder="ICE"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field icon={MapPin}>
              <input
                name="ville"
                placeholder="Ville"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>
            <Field icon={Phone}>
              <input
                name="tel"
                type="tel"
                placeholder="Téléphone entreprise"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>
          </div>
          <Field icon={Mail}>
            <input
              name="emailEnt"
              type="email"
              placeholder="Email entreprise"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
          <Field icon={MapPinned}>
            <input
              name="adresse"
              placeholder="Adresse complète"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  name="secteur"
                  defaultValue=""
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: `right 0.75rem center`,
                    backgroundRepeat: `no-repeat`,
                    backgroundSize: `1.25rem`,
                  }}
                >
                  {SECTEUR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Users className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  name="taille"
                  defaultValue=""
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: `right 0.75rem center`,
                    backgroundRepeat: `no-repeat`,
                    backgroundSize: `1.25rem`,
                  }}
                >
                  {TAILLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Logo ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Logo de l&apos;entreprise</h2>
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition hover:border-slate-300">
          {logoPreview ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Aperçu logo" className="h-full w-full object-contain p-2" />
              </div>
              <label className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                Changer le logo
                <input
                  name="logo"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              <p className="text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo</p>
              {state.fieldErrors?.logo && <p className="text-xs text-red-500">{state.fieldErrors.logo}</p>}
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Ajouter un logo</p>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP • Max 5 Mo</p>
              </div>
              <input
                name="logo"
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>
          )}
          <p className="mt-4 text-center text-xs text-slate-400">
            Ce logo sera utilisé sur vos devis, factures et documents PDF.
          </p>
          {state.fieldErrors?.logo && !logoPreview && <p className="mt-2 text-center text-xs text-red-500">{state.fieldErrors.logo}</p>}
        </div>
      </section>

      {/* ── Section 3: Compte administrateur ──────────────────────── */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Votre compte administrateur</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field icon={User} error={state.fieldErrors?.firstName}>
              <input
                name="firstName"
                placeholder="Prénom *"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </Field>
            <Field icon={User} error={state.fieldErrors?.lastName}>
              <input
                name="lastName"
                placeholder="Nom *"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </Field>
          </div>
          <Field icon={Mail} error={state.fieldErrors?.email}>
            <input
              name="email"
              type="email"
              placeholder="Email *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
          <p className="-mt-2 text-xs text-slate-400">Cet email sera votre login administrateur.</p>
          <Field icon={Lock} error={state.fieldErrors?.password}>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mot de passe *"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <p className="-mt-2 text-xs text-slate-400">Minimum 8 caractères.</p>
          <Field icon={Phone}>
            <input
              name="phone"
              type="tel"
              placeholder="Téléphone"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </Field>
        </div>
      </section>

      {/* ── Global error ──────────────────────────────────────────── */}
      {state.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* ── Submit ────────────────────────────────────────────────── */}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base font-semibold">
        {pending ? "Création en cours..." : "Créer mon entreprise"}
      </Button>

      {/* ── Trust signals ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Données sécurisées
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Essai Essentiel inclus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Sans engagement
        </span>
      </div>
    </form>
  );
}
