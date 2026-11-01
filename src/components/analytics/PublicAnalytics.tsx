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
      <div className={styles.copy}>
        <h2>Votre choix pour les cookies</h2>
        <p>Avec votre accord, Google Analytics mesure les visites et les clics du site public. Aucun suivi dans votre espace ERP. Vous pouvez changer d’avis à tout moment.</p>
        <a href="/confidentialite#cookies">En savoir plus</a>
      </div>
      <div className={styles.actions}>
        <button ref={acceptButton} type="button" onClick={() => choose("accepted")}>Accepter la mesure</button>
        <button type="button" onClick={() => choose("refused")}>Refuser la mesure</button>
        {snapshot.choice !== null ? <button type="button" className={styles.close} onClick={closeSettings}>Fermer</button> : null}
      </div>
    </section>
  );
}

/** Small footer control; opening settings never changes consent or loads Google. */
export function AnalyticsSettingsButton({ className }: { className?: string }) {
  if (!validMeasurementId(MEASUREMENT_ID)) return null;
  return <button className={className || styles.settings} type="button" onClick={() => window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT))}>Paramètres des cookies</button>;
}
