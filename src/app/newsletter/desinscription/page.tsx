"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/newsletter/newsletter.module.css";

function UnsubscribeForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; message?: string; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "La désinscription n’a pas abouti. Réessayez dans un instant.");
        return;
      }
      setMessage(data.message || "Vous êtes désinscrit.");
    } catch {
      setError("La désinscription n’a pas abouti. Réessayez dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Désinscription</h1>
      {message ? <p className={styles.status} role="status">{message}</p> : valid ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <p>Confirmez pour ne plus recevoir les actualités de Felexia. Cette action ne supprime pas un guide déjà téléchargé.</p>
          <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Envoi…" : "Me désinscrire"}</button>
        </form>
      ) : <p className={styles.alert} role="alert">Ce lien n’est pas valide.</p>}
      {error ? <p className={styles.alert} role="alert">{error}</p> : null}
      <p><Link href="/">Retour à l’accueil</Link></p>
    </main>
  );
}

export default function UnsubscribePage() {
  return <Suspense fallback={<main className={styles.page}><h1>Désinscription</h1></main>}><UnsubscribeForm /></Suspense>;
}
