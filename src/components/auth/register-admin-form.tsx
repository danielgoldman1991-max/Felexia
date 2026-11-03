"use client";

import { useState } from "react";
import { getAppUrl } from "@/lib/app-url";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getCompanyOnboardingPath } from "@/lib/auth/onboarding-continuation";

function Field({ icon: Icon, children, error, id, label }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; error?: string; id: string; label: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
        {children}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RegisterAdminForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    const errors: Record<string, string> = {};
    if (!firstName) errors.firstName = "Prénom requis";
    if (!lastName) errors.lastName = "Nom requis";
    if (!email || !email.includes("@")) errors.email = "Email valide requis";
    if (!password || password.length < 8) errors.password = "Minimum 8 caractères";
    if (!confirmPassword) errors.confirmPassword = "Veuillez confirmer le mot de passe.";
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = "Les mots de passe ne correspondent pas.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPending(false);
      return;
    }

    try {
      const supabase = createClient();
      const onboardingPath = getCompanyOnboardingPath(nextPath);
      const callback = new URL("/auth/callback", getAppUrl(window.location.origin));
      callback.searchParams.set("next", onboardingPath);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            full_name: `${firstName} ${lastName}`,
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!signUpData.user) {
        setError("Impossible de créer le compte utilisateur.");
        return;
      }
      if (!signUpData.session) {
        // Confirmation-required signups have no session yet. Keep the notice in
        // the destination URL instead of losing a local message on navigation.
        router.replace(`/login?notice=confirm_email&next=${encodeURIComponent(onboardingPath)}`);
        return;
      }

      const response = await fetch("/api/auth/create-profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: `${firstName} ${lastName}` }),
      });
      if (!response.ok) {
        setError("Votre compte est créé. Connectez-vous pour reprendre la configuration de votre entreprise.");
        return;
      }
      router.replace(onboardingPath);
    } catch {
      setError("La connexion a été interrompue. Réessayez ou connectez-vous si votre compte a déjà été créé.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={User} error={fieldErrors.firstName} id="register-first-name" label="Prénom *">
            <input
              id="register-first-name"
              name="firstName"
              autoComplete="given-name"
              aria-invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? "register-first-name-error" : undefined}
              placeholder="Prénom *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
          <Field icon={User} error={fieldErrors.lastName} id="register-last-name" label="Nom *">
            <input
              id="register-last-name"
              name="lastName"
              autoComplete="family-name"
              aria-invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? "register-last-name-error" : undefined}
              placeholder="Nom *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
        </div>
        <Field icon={Mail} error={fieldErrors.email} id="register-email" label="Email *">
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "register-email-hint register-email-error" : "register-email-hint"}
            placeholder="Email *"
            defaultValue=""
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </Field>
        <p id="register-email-hint" className="-mt-2 text-xs text-slate-600">Votre email servira de login pour accéder à Felexia.</p>
        <Field icon={Lock} error={fieldErrors.password} id="register-password" label="Mot de passe *">
          <div className="relative">
            <input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "register-password-hint register-password-error" : "register-password-hint"}
              placeholder="Mot de passe *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword}
              aria-controls="register-password register-confirm-password"
              className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>
        <p id="register-password-hint" className="-mt-2 text-xs text-slate-600">Minimum 8 caractères.</p>
        <Field icon={Lock} error={fieldErrors.confirmPassword} id="register-confirm-password" label="Confirmation du mot de passe *">
          <div className="relative">
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={fieldErrors.confirmPassword ? "register-confirm-password-error" : undefined}
              placeholder="Confirmation du mot de passe *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "Masquer la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"}
              aria-pressed={showPassword}
              aria-controls="register-password register-confirm-password"
              className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base font-semibold">
        {pending ? "Création en cours..." : "Créer mon compte et continuer"}
      </Button>

      <div className="flex items-center justify-center gap-6 text-xs text-slate-600">
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
