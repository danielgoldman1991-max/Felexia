"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  applyParentAdsConsent,
  flushTrialConversion,
  googleAdsId,
  GOOGLE_ADS_SIGNUP_COOKIE,
  isGoogleAdsSurface,
  queueTrialConversion,
  readSignupCookie,
  readStoredAdsChoice,
} from "@/lib/analytics/google-ads";

function consumeSignupMarkers() {
  const fromCookie = readSignupCookie(document.cookie);
  if (fromCookie) {
    document.cookie = `${GOOGLE_ADS_SIGNUP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    queueTrialConversion(fromCookie, window.sessionStorage);
  }
  const current = new URL(window.location.href);
  const fromQuery = current.searchParams.get("signup");
  if (fromQuery) {
    queueTrialConversion(fromQuery, window.sessionStorage);
    current.searchParams.delete("signup");
    const next = current.pathname + (current.searchParams.size ? `?${current.searchParams.toString()}` : "") + current.hash;
    window.history.replaceState(window.history.state, "", next);
  }
  const choice = readStoredAdsChoice(window.localStorage);
  if (choice) applyParentAdsConsent(window, choice);
  flushTrialConversion(window, window.sessionStorage);
}

/** Loads the Ads tag on public pages, login and onboarding. The ERP does not load it. */
export function GoogleAds() {
  const pathname = usePathname();
  const enabled = Boolean(pathname && isGoogleAdsSurface(pathname));
  const id = googleAdsId();

  useEffect(() => {
    if (enabled) consumeSignupMarkers();
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <>
      <Script id="google-ads-config" strategy="afterInteractive">{`window.gtag&&window.gtag('config',${JSON.stringify(id)});`}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onLoad={consumeSignupMarkers} />
    </>
  );
}
