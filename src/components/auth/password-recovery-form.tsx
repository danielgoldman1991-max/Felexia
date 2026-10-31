"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordRecovery, completePasswordRecovery, type PasswordRecoveryState } from "@/lib/actions/password-recovery";

const initialState: PasswordRecoveryState = { error: null };

export function PasswordRecoveryForm({ complete = false }: { complete?: boolean }) {
  const [state, formAction, pending] = useActionState(complete ? completePasswordRecovery : requestPasswordRecovery, initialState);
  return <form action={formAction} className="space-y-5">
    {state.sent ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Si un compte correspond à cette adresse, vous recevrez un lien de récupération. Consultez également vos courriers indésirables. Le lien doit être ouvert dans ce navigateur.</div> : <>
      {complete ? <>
        <label className="block space-y-2 text-sm font-medium">Nouveau mot de passe<Input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <label className="block space-y-2 text-sm font-medium">Confirmer le mot de passe<Input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <p className="text-sm text-[var(--muted)]">Au moins 12 caractères, dont une lettre et un chiffre.</p>
      </> : <label className="block space-y-2 text-sm font-medium">Adresse email<Input name="email" type="email" autoComplete="email" maxLength={254} placeholder="email@entreprise.ma" required /></label>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Veuillez patienter…" : complete ? "Enregistrer mon nouveau mot de passe" : "Recevoir le lien de récupération"}</Button>
    </>}
    {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
    <Link href="/login" className="block text-center text-sm font-medium text-[var(--primary)]">Retour à la connexion</Link>
  </form>;
}
