"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AcceptState = { error: string | null };

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();

  async function acceptAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
    const password = String(formData.get("password") ?? "");

    if (password.length < 6) {
      return { error: "Le mot de passe doit faire au moins 6 caracteres." };
    }

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || "Erreur lors de l'acceptation." };
      }
      router.push("/dashboard");
      return { error: null };
    } catch {
      return { error: "Erreur reseau." };
    }
  }

  const [state, formAction, pending] = useActionState(acceptAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Invitation pour: <span className="font-medium text-[var(--foreground)]">{email}</span>
      </p>
      <Input
        name="password"
        type="password"
        placeholder="Choisissez un mot de passe"
        autoComplete="new-password"
        required
      />
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Traitement..." : "Accepter et rejoindre"}
      </Button>
    </form>
  );
}
