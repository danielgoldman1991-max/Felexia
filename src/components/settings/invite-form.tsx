"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InviteState = { error: string | null; success: boolean };

export function InviteForm({
  organizationId,
  roles,
}: {
  organizationId: string;
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function inviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
    const email = String(formData.get("email") ?? "").trim();
    const roleId = String(formData.get("roleId") ?? "");

    if (!email) {
      return { error: "Email requis.", success: false };
    }

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleId, organizationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || "Erreur lors de l'invitation.", success: false };
      }
      router.refresh();
      return { error: null, success: true };
    } catch {
      return { error: "Erreur reseau.", success: false };
    }
  }

  const [state, formAction, pending] = useActionState(inviteAction, { error: null, success: false });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex-1">
        <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-[var(--secondary)]">
          Email du collaborateur
        </label>
        <Input id="invite-email" name="email" type="email" placeholder="collaborateur@entreprise.ma" required />
      </div>
      <div>
        <label htmlFor="invite-role" className="mb-1 block text-xs font-medium text-[var(--secondary)]">
          Role
        </label>
        <select
          id="invite-role"
          name="roleId"
          className="block rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Inviter"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="w-full text-sm text-green-600">Invitation envoyee.</p>
      )}
    </form>
  );
}
