"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeInvitationAction } from "@/lib/actions/complete-invitation";

/**
 * Étape 2 du flux d'invitation Supabase : définition du mot de passe.
 * La session invite a déjà été établie (verifyOtp) ; la soumission définit
 * le mot de passe puis crée le membership (RPC atomique côté serveur).
 */
export function CompleteInviteForm({
  invitationId,
  email,
  orgName,
  fullName = "",
}: {
  invitationId: string;
  email: string;
  orgName: string;
  fullName?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await completeInvitationAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="invitationId" value={invitationId} />
      <p className="text-sm text-[var(--muted)]">
        Invitation pour: <span className="font-medium text-[var(--foreground)]">{email}</span>
      </p>
      <Input
        name="fullName"
        placeholder="Nom complet (optionnel)"
        autoComplete="name"
        defaultValue={fullName}
      />
      <Input
        name="password"
        type="password"
        placeholder="Choisissez un mot de passe"
        autoComplete="new-password"
        required
        minLength={6}
      />
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création de votre compte..." : "Rejoindre " + orgName}
      </Button>
    </form>
  );
}
