"use client";

import { useActionState } from "react";
import { createCompanyAction, type CompanyState } from "@/lib/auth-actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: CompanyState = { error: null };

export function CompanySetupForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        name="companyName"
        placeholder="Nom de l'entreprise"
        required
      />
      <Input
        name="slug"
        placeholder="Identifiant (ex: mon-entreprise)"
        required
      />
      <p className="text-xs text-[var(--muted)]">
        L&apos;identifiant servira d&apos;URL unique pour votre espace.
      </p>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creation en cours..." : "Creer mon entreprise"}
      </Button>
    </form>
  );
}
