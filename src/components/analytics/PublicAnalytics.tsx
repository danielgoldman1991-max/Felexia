"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicSitePath } from "@/lib/public-site";
import { ANALYTICS_SETTINGS_EVENT, PublicAnalyticsController, validMeasurementId, type AnalyticsSnapshot } from "@/lib/analytics/public-analytics";
import styles from "./PublicAnalytics.module.css";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function PublicAnalytics() {
  const pathname = usePathname();
  const controller = useRef<PublicAnalyticsController | null>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>({ available: false, choice: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const publicPage = Boolean(pathname && isPublicSitePath(pathname));

  useEffect(() => {
    const analytics = new PublicAnalyticsController(window, document, MEASUREMENT_ID, setSnapshot);
    controller.current = analytics;
    const stop = analytics.start();
    const openSettings = () => {
      settingsTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSettingsOpen(true);
    };
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    return () => {
      stop();
      controller.current = null;
      window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    };
  }, []);

  // Remove the Google document before painting a private App Router destination.
  useLayoutEffect(() => { controller.current?.sync(); }, [pathname]);
  useEffect(() => {
    if (settingsOpen && publicPage && snapshot.available) acceptButton.current?.focus();
  }, [settingsOpen, publicPage, snapshot.available]);

  if (!publicPage || !snapshot.available || (snapshot.choice !== null && !settingsOpen)) return null;

  function choose(choice: "accepted" | "refused") {
    controller.current?.setChoice(choice);
    closeSettings();
  }

  function closeSettings() {
    setSettingsOpen(false);
    settingsTrigger.current?.focus();
    settingsTrigger.current = null;
  }

  return (
    <section className={styles.banner} role="region" aria-label="Préférences de cookies" onKeyDown={(event) => { if (event.key === "Escape" && snapshot.choice !== null) closeSettings(); }}>
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9 4 4 0 0 0 4 4 4 4 0 0 0 5 5Z" />
            <path d="M8 8h.01M7 14h.01M12 17h.01M15 12h.01" strokeWidth="2.8" />
          </svg>
        </span>
        <h2>Votre choix pour les cookies</h2>
      </div>
      <div className={styles.copy}>
        <p>Google Analytics mesure les visites et les clics du site public uniquement avec votre accord. Aucun suivi dans votre espace ERP.</p>
      </div>
      <div className={styles.actions}>
        <button ref={acceptButton} type="button" onClick={() => choose("accepted")}>Accepter<span className={styles.srOnly}> la mesure</span></button>
        <button type="button" onClick={() => choose("refused")}>Refuser<span className={styles.srOnly}> la mesure</span></button>
        {snapshot.choice !== null ? <button type="button" className={styles.close} onClick={closeSettings}>Fermer</button> : null}
      </div>
      <div className={styles.details}>
        <span>Changez d’avis à tout moment.</span>
        <a href="/confidentialite#cookies">En savoir plus<span aria-hidden="true"> ↗</span></a>
      </div>
    </section>
  );
}

/** Small footer control; opening settings never changes consent or loads Google. */
export function AnalyticsSettingsButton({ className }: { className?: string }) {
  if (!validMeasurementId(MEASUREMENT_ID)) return null;
  return <button className={className || styles.settings} type="button" onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}>Paramètres des cookies</button>;
}
