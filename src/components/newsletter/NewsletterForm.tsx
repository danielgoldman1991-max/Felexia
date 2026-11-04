"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { trackPublicMarketingEvent } from "@/lib/analytics/public-analytics";
import type { NewsletterSource } from "@/lib/newsletter/validate";
import styles from "./newsletter.module.css";

type Status = { tone: "ok" | "error"; text: string };

export function NewsletterBand({
  source,
  title = "Les actualités Felexia",
  text = "Recevez les guides et les nouveautés utiles aux PME au Maroc. Vous pouvez vous désinscrire à tout moment.",
}: {
  source: NewsletterSource;
  title?: string;
  text?: string;
}) {
  const titleId = useId();
  return (
    <section className={styles.band} aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{text}</p>
      </div>
      <NewsletterForm source={source} />
    </section>
  );
}

export function NewsletterForm({ source, compact = false }: { source: NewsletterSource; compact?: boolean }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, firstName, company, consent, source, fax_number: fax }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; status?: string; message?: string; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setStatus({ tone: "error", text: data?.error || "L’inscription n’a pas abouti. Réessayez dans un instant." });
        return;
      }
      setStatus({ tone: "ok", text: data.message || "Merci, votre inscription est confirmée." });
      if (data.status === "subscribed" || data.status === "resubscribed") trackPublicMarketingEvent("newsletter_signup");
      window.dispatchEvent(new CustomEvent("felexia:newsletter-joined", { detail: { source } }));
    } catch {
      setStatus({ tone: "error", text: "L’inscription n’a pas abouti. Réessayez dans un instant." });
    } finally {
      setPending(false);
    }
  }

  if (status?.tone === "ok") return <p className={styles.status} role="status">{status.text}</p>;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={compact ? styles.grid : `${styles.grid} ${styles.two}`}>
        <label className={styles.field} htmlFor={`${id}-email`}>E-mail
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className={styles.field} htmlFor={`${id}-first`}><span>Prénom <span className={styles.optional}>(facultatif)</span></span>
          <input id={`${id}-first`} name="firstName" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        {compact ? null : (
          <label className={styles.field} htmlFor={`${id}-company`}><span>Société <span className={styles.optional}>(facultatif)</span></span>
            <input id={`${id}-company`} name="company" autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
        )}
      </div>
      <label className={styles.check}>
        <input type="checkbox" name="consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>J’accepte de recevoir les actualités de Felexia. Désinscription possible à tout moment. <Link href="/confidentialite">Politique de confidentialité</Link></span>
      </label>
      <div className={styles.trap} aria-hidden="true">
        <label>Fax<input tabIndex={-1} autoComplete="off" value={fax} onChange={(event) => setFax(event.target.value)} /></label>
      </div>
      {status?.tone === "error" ? <p className={styles.alert} role="alert">{status.text}</p> : null}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Envoi…" : "M’inscrire"}</button>
    </form>
  );
}
