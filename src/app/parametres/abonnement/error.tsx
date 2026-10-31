"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SubscriptionError({ reset }: { reset: () => void }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
    <h1 className="text-2xl font-semibold">Abonnement temporairement indisponible</h1>
    <p role="alert" className="mt-3 text-[var(--muted)]">Votre abonnement n’a pas pu être chargé. Vos données sont conservées et aucun essai n’a été recréé.</p>
    <div className="mt-6 flex flex-wrap gap-3"><Button onClick={reset}>Réessayer</Button><Button variant="secondary" asChild><Link href="/dashboard">Retour à l’accueil</Link></Button></div>
  </section>;
}
