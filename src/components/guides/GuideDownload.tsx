"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { trackPublicMarketingEvent } from "@/lib/analytics/public-analytics";
import { getProductGuide } from "@/lib/content/product-guides";
import { clearGuideGrant, readGuideGrant, writeGuideGrant } from "@/lib/guides/remember";
import { GUIDE_SECTORS } from "@/lib/newsletter/validate";
import styles from "./guide-download.module.css";

export const OPEN_GUIDE_EVENT = "felexia:open-guide";

type Thanks = { message: string; downloadPath: string; rememberToken: string };

function triggerDownload(url: string) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Téléchargement du guide";
  frame.referrerPolicy = "no-referrer";
  frame.src = url;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 60_000);
}

async function redeem(slug: string, token: string): Promise<string | null> {
  const response = await fetch("/api/guides/access", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ slug, token, fax_number: "" }),
  });
  const data = await response.json().catch(() => null) as { downloadPath?: string; rememberToken?: string } | null;
  if (!response.ok || !data?.downloadPath) return null;
  if (data.rememberToken) writeGuideGrant(slug, data.rememberToken);
  triggerDownload(data.downloadPath);
  trackPublicMarketingEvent("guide_download");
  return data.downloadPath;
}

export function GuideDownloadButton({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  async function onClick() {
    const token = readGuideGrant(slug);
    if (token) {
      setPending(true);
      try {
        const path = await redeem(slug, token);
        if (path) return;
        clearGuideGrant(slug);
      } catch {
        clearGuideGrant(slug);
      } finally {
        setPending(false);
      }
    }
    window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: { slug } }));
  }
  return <button type="button" className={`${styles.trigger} ${className ?? ""}`} onClick={onClick} disabled={pending}>{pending ? "Préparation…" : children}</button>;
}

export function GuideDownloadHost() {
  const titleId = useId();
  const formId = useId();
  const [slug, setSlug] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [guideConsent, setGuideConsent] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [fax, setFax] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState<Thanks | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profilePending, setProfilePending] = useState(false);
  const guide = slug ? getProductGuide(slug) : undefined;

  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (!next || !getProductGuide(next)) return;
      setSlug(next);
      setThanks(null);
      setError("");
      setGuideConsent(false);
      setNewsletter(false);
      setCompany("");
      setPhone("");
      setSector("");
      setProfileOpen(false);
      setProfileSaved(false);
      setProfileError("");
    };
    window.addEventListener(OPEN_GUIDE_EVENT, open);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, open);
  }, []);

  useEffect(() => {
    if (!slug) return;
    document.documentElement.dataset.guideDialogOpen = "true";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSlug(null); };
    document.addEventListener("keydown", onKey);
    return () => {
      delete document.documentElement.dataset.guideDialogOpen;
      document.removeEventListener("keydown", onKey);
    };
  }, [slug]);

  if (!slug || !guide) return null;

  function close() { setSlug(null); }

  async function onProfile(event: FormEvent) {
    event.preventDefault();
    if (!thanks?.rememberToken || !slug) return;
    setProfilePending(true);
    setProfileError("");
    try {
      const response = await fetch("/api/guides/profile", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ slug, token: thanks.rememberToken, company, phone, sector, fax_number: fax }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setProfileError(data?.error || "L’enregistrement n’a pas abouti. Vous pouvez passer cette étape.");
        return;
      }
      setProfileSaved(true);
      setProfileOpen(false);
    } catch {
      setProfileError("L’enregistrement n’a pas abouti. Vous pouvez passer cette étape.");
    } finally {
      setProfilePending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/guides/request", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          email, firstName, guideConsent, newsletter, slug, fax_number: fax,
        }),
      });
      const data = await response.json().catch(() => null) as {
        ok?: boolean; error?: string; message?: string; downloadPath?: string; rememberToken?: string; status?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Le guide n’a pas pu être préparé. Réessayez dans un instant.");
        return;
      }
      if (data.downloadPath && data.rememberToken) {
        writeGuideGrant(slug!, data.rememberToken);
        triggerDownload(data.downloadPath);
        trackPublicMarketingEvent("guide_download");
        if (newsletter && data.status !== "already") trackPublicMarketingEvent("newsletter_signup");
        if (newsletter) window.dispatchEvent(new CustomEvent("felexia:newsletter-joined", { detail: { source: "guide" } }));
        setThanks({ message: data.message || "Merci. Votre guide se télécharge.", downloadPath: data.downloadPath, rememberToken: data.rememberToken });
        setProfileOpen(true);
        return;
      }
      setThanks({ message: data.message || "Merci. Votre guide se télécharge.", downloadPath: "", rememberToken: "" });
    } catch {
      setError("Le guide n’a pas pu être préparé. Réessayez dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.closeRow}><button type="button" className={styles.close} aria-label="Fermer" onClick={close}>×</button></div>
        <p className={styles.kicker}>{guide.kicker} · {guide.pages} pages</p>
        <h2 id={titleId}>Télécharger le guide</h2>
        {thanks ? (
          <div className={styles.thanks}>
            <p role="status">{thanks.message}</p>
            {thanks.downloadPath ? <a className={styles.download} href={thanks.downloadPath} rel="nofollow noreferrer">Télécharger le guide (PDF)</a> : null}
            <p className={styles.note}>Le lien direct reste valable quelques minutes. Depuis ce navigateur, le bouton du site relance le téléchargement sans ressaisir le formulaire.</p>
            {profileSaved ? <p className={styles.note}>Merci, ces précisions sont enregistrées.</p> : null}
            {profileOpen && thanks.rememberToken ? (
              <form className={styles.profile} onSubmit={onProfile}>
                <p className={styles.profileTitle}>Aidez-nous à mieux vous connaître</p>
                <p className={styles.note}>Facultatif. Vous pouvez passer cette étape.</p>
                <label className={styles.field} htmlFor={`${formId}-company`}><span>Société <span className={styles.optional}>(facultatif)</span></span>
                  <input id={`${formId}-company`} autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} />
                </label>
                <label className={styles.field} htmlFor={`${formId}-phone`}><span>Téléphone <span className={styles.optional}>(facultatif)</span></span>
                  <input id={`${formId}-phone`} autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label className={styles.field} htmlFor={`${formId}-sector`}><span>Secteur <span className={styles.optional}>(facultatif)</span></span>
                  <select id={`${formId}-sector`} value={sector} onChange={(event) => setSector(event.target.value)}>
                    <option value="">—</option>
                    {GUIDE_SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <div className={styles.trap} aria-hidden="true">
                  <label>Fax<input tabIndex={-1} autoComplete="off" value={fax} onChange={(event) => setFax(event.target.value)} /></label>
                </div>
                {profileError ? <p className={styles.alert} role="alert">{profileError}</p> : null}
                <div className={styles.profileActions}>
                  <button className={styles.submit} type="submit" disabled={profilePending}>{profilePending ? "Enregistrement…" : "Enregistrer"}</button>
                  <button className={styles.skip} type="button" onClick={() => setProfileOpen(false)}>Passer</button>
                </div>
              </form>
            ) : null}
          </div>
        ) : (
          <>
            <p className={styles.intro}>Le fichier est gratuit. Votre e-mail sert à vous envoyer ce guide. La lettre d’information reste un choix séparé, décoché par défaut.</p>
            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.field} htmlFor={`${formId}-email`}>E-mail
                <input id={`${formId}-email`} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className={styles.field} htmlFor={`${formId}-first`}><span>Prénom <span className={styles.optional}>(facultatif)</span></span>
                <input id={`${formId}-first`} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={guideConsent} onChange={(event) => setGuideConsent(event.target.checked)} />
                <span>J’accepte que Felexia enregistre mon e-mail pour m’envoyer ce guide. <Link href="/confidentialite">Politique de confidentialité</Link></span>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={newsletter} onChange={(event) => setNewsletter(event.target.checked)} />
                <span>J’accepte de recevoir les actualités de Felexia. Désinscription possible à tout moment.</span>
              </label>
              <div className={styles.trap} aria-hidden="true">
                <label>Fax<input tabIndex={-1} autoComplete="off" value={fax} onChange={(event) => setFax(event.target.value)} /></label>
              </div>
              {error ? <p className={styles.alert} role="alert">{error}</p> : null}
              <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Préparation…" : "Recevoir le guide"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
