"use client";

import { useActionState } from "react";
import { signUpAction, type SignUpState } from "@/lib/auth-actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const initialState: SignUpState = { error: null };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        name="fullName"
        placeholder="Nom complet"
        autoComplete="name"
        required
      />
      <Input
        name="email"
        type="email"
        placeholder="email@entreprise.ma"
        autoComplete="email"
        required
      />
      <Input
        name="password"
        type="password"
        placeholder="Mot de passe (min. 6 caracteres)"
        autoComplete="new-password"
        required
      />
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creation en cours..." : "Creer mon compte"}
      </Button>
      <p className="text-center text-sm text-[var(--muted)]">
        Deja un compte ?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
