"use client";

import { useState, useActionState } from "react";
import { User, Mail, Lock, Phone, Eye, EyeOff } from "lucide-react";
import { registerAdminAction, type RegisterAdminState } from "@/lib/actions/register-admin";
import { Button } from "@/components/ui/button";

const initialState: RegisterAdminState = { error: null };

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
  const [state, formAction, pending] = useActionState(registerAdminAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
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
        <p className="-mt-2 text-xs text-slate-400">Votre email servira de login pour accéder à Felexia.</p>
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

      {state.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base font-semibold">
        {pending ? "Création en cours..." : "Créer mon compte et continuer"}
      </Button>

      {state.success && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Données sécurisées
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          15 jours d&apos;essai gratuit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Sans engagement
        </span>
      </div>
    </form>
  );
}