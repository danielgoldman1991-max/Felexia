"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CHOICE_KEY, parseAnalyticsChoice, validMeasurementId } from "@/lib/analytics/public-analytics";
import { isPublicSitePath } from "@/lib/public-site";
import { NEWSLETTER_PROMPT_KEY, promptHidden, promptRecord } from "@/lib/newsletter/prompt-storage";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./newsletter.module.css";

function analyticsBlocking(): boolean {
  if (!validMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)) return false;
  try {
    return parseAnalyticsChoice(localStorage.getItem(ANALYTICS_CHOICE_KEY), Date.now()) === null;
  } catch {
    return true;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(NEWSLETTER_PROMPT_KEY, JSON.stringify(promptRecord(Date.now())));
  } catch {
    /* Private mode can reject storage. The prompt simply will not persist. */
  }
}

let audienceRequest: Promise<boolean> | null = null;

function visitorIsSignedIn(): Promise<boolean> {
  audienceRequest ??= fetch("/api/newsletter/audience", { headers: { accept: "application/json" } })
    .then((response) => response.json())
    .then((data: { signedIn?: boolean }) => Boolean(data?.signedIn))
    .catch(() => false);
  return audienceRequest;
}

export function NewsletterPrompt() {
  const pathname = usePathname();
  const publicPage = Boolean(pathname && isPublicSitePath(pathname));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!publicPage) return;
    let cancelled = false;
    let shown = false;
    let armedByTime = false;
    const progress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 80) return 0;
      return window.scrollY / scrollable;
    };
    const canShow = async () => {
      if (cancelled || shown) return;
      try {
        if (promptHidden(localStorage.getItem(NEWSLETTER_PROMPT_KEY), Date.now())) { shown = true; return; }
      } catch {
        return;
      }
      if (document.documentElement.dataset.guideDialogOpen === "true" || analyticsBlocking()) return;
      if (!(armedByTime || progress() >= 0.5)) return;
      const signedIn = await visitorIsSignedIn();
      if (cancelled || signedIn) { shown = true; return; }
      if (document.documentElement.dataset.guideDialogOpen === "true" || analyticsBlocking()) return;
      shown = true;
      setOpen(true);
    };
    const onScroll = () => { if (progress() >= 0.5) void canShow(); };
    const onJoined = (event: Event) => {
      rememberDismissal();
      shown = true;
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== "popup") setOpen(false);
    };
    const timer = window.setTimeout(() => { armedByTime = true; void canShow(); }, 25_000);
    const retry = window.setInterval(() => { void canShow(); }, 5_000);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("felexia:newsletter-joined", onJoined);
    onScroll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(retry);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("felexia:newsletter-joined", onJoined);
    };
  }, [publicPage, pathname]);

  if (!publicPage || !open) return null;

  return (
    <aside className={styles.prompt} role="region" aria-label="Inscription à la lettre d’information">
      <div className={styles.promptHeader}>
        <div>
          <h2>Les actualités Felexia</h2>
          <p>Un e-mail lorsque nous publions un guide utile. Pas de relance déguisée.</p>
        </div>
        <button type="button" className={styles.close} aria-label="Fermer" onClick={() => { rememberDismissal(); setOpen(false); }}>×</button>
      </div>
      <NewsletterForm source="popup" compact />
    </aside>
  );
}
