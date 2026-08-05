"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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

export function RegisterAdminForm() {
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

    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    if (!signUpData.user) {
      setError("Impossible de créer le compte utilisateur.");
      setPending(false);
      return;
    }

    let hasSession = Boolean(signUpData.session);

    if (!hasSession) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session) {
        setError("Compte créé. Veuillez confirmer votre email puis vous connecter pour créer votre entreprise.");
        setPending(false);
        router.push("/login?next=/onboarding/entreprise");
        return;
      }

      hasSession = true;
    }

    if (hasSession) {
      await supabase.auth.getSession();
    }

    // Create profile via server action
    try {
      const response = await fetch("/api/auth/create-profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName: `${firstName} ${lastName}`,
        }),
      });

      if (!response.ok) {
        setError("Votre compte a été créé, mais le profil n’a pas pu être initialisé. Veuillez réessayer.");
        setPending(false);
        return;
      }
    } catch {
      setError("Votre compte a été créé, mais le profil n’a pas pu être initialisé. Veuillez réessayer.");
      setPending(false);
      return;
    }

    router.push("/onboarding/entreprise");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={User} error={fieldErrors.firstName}>
            <input
              name="firstName"
              placeholder="Prénom *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
          <Field icon={User} error={fieldErrors.lastName}>
            <input
              name="lastName"
              placeholder="Nom *"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </Field>
        </div>
        <Field icon={Mail} error={fieldErrors.email}>
          <input
            name="email"
            type="email"
            placeholder="Email *"
            defaultValue=""
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </Field>
        <p className="-mt-2 text-xs text-slate-400">Votre email servira de login pour accéder à Felexia.</p>
        <Field icon={Lock} error={fieldErrors.password}>
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
        <Field icon={Lock} error={fieldErrors.confirmPassword}>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Confirmation du mot de passe *"
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
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base font-semibold">
        {pending ? "Création en cours..." : "Créer mon compte et continuer"}
      </Button>

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
